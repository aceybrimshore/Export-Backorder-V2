import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { RawBackorderItem, RawWorkOrder } from '../types';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Code2,
  Sparkles,
  Loader2,
  ArrowRight,
  RefreshCw,
  Wrench,
  Layers,
  FileUp
} from 'lucide-react';

export interface UploadSummary {
  backordersCount: number;
  workOrdersCount: number;
  uniqueSkusCount: number;
  totalBoQty: number;
  totalBoValue: number;
  timestamp: string;
}

interface CsvUploadModalProps {
  onClose: () => void;
  onApplyUploadedData: (
    backorders: RawBackorderItem[],
    workOrders: RawWorkOrder[],
    summary?: UploadSummary
  ) => void;
}

export type DatasetType = 'BACKORDERS' | 'WORK_ORDERS';

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  onClose,
  onApplyUploadedData
}) => {
  // Individual Dataset Files & Text
  const [boFile, setBoFile] = useState<File | null>(null);
  const [woFile, setWoFile] = useState<File | null>(null);

  const [boText, setBoText] = useState('');
  const [woText, setWoText] = useState('');

  // Individual Paste Drawers open state
  const [showBoPaste, setShowBoPaste] = useState(false);
  const [showWoPaste, setShowWoPaste] = useState(false);

  // Live parsed row previews
  const [boPreviewCount, setBoPreviewCount] = useState<number | null>(null);
  const [woPreviewCount, setWoPreviewCount] = useState<number | null>(null);

  // Auto-detection status notifications
  const [autoDetectedLogs, setAutoDetectedLogs] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // UI Processing & SuiteQL Modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<UploadSummary | null>(null);
  const [showSuiteQL, setShowSuiteQL] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const dropzoneInputRef = useRef<HTMLInputElement>(null);

  // Helper to classify CSV headers and filename to auto-detect dataset type
  const classifyCsv = (headers: string[], filename: string): DatasetType => {
    const cleanHeaders = headers.map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ' '));
    const cleanFilename = filename.toLowerCase();

    let boScore = 0;
    let woScore = 0;

    // Filename indicators
    if (cleanFilename.includes('backorder') || cleanFilename.includes('bo') || cleanFilename.includes('demand') || cleanFilename.includes('sales')) boScore += 4;
    if (cleanFilename.includes('workorder') || cleanFilename.includes('work_order') || cleanFilename.includes('wo') || cleanFilename.includes('schedule') || cleanFilename.includes('production')) woScore += 4;

    // Header column indicators
    const boKeywords = ['quantitybackordered', 'back order qty', 'bo qty', 'sales order number', 'so number', 'sales order', 'stock required by', 'expected ship date', 'customer name', 'back order value', 'so#'];
    for (const h of cleanHeaders) {
      if (boKeywords.some(k => h.includes(k))) boScore += 2;
    }

    const woKeywords = ['scheduled qty', 'earliest wo start', 'wo numbers', 'wo #', 'work order #', 'scheduled quantity', 'part #', 'assembly'];
    for (const h of cleanHeaders) {
      if (woKeywords.some(k => h.includes(k))) woScore += 2;
    }

    if (boScore >= woScore && boScore > 0) return 'BACKORDERS';
    if (woScore > boScore) return 'WORK_ORDERS';

    // Default fallback based on filename or first unassigned slot
    return 'BACKORDERS';
  };

  // Inspect backorders CSV preview
  useEffect(() => {
    if (boFile) {
      boFile.text().then(text => {
        try {
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          setBoPreviewCount(parsed.data.length);
        } catch {
          setBoPreviewCount(null);
        }
      });
    } else if (boText.trim()) {
      try {
        const parsed = Papa.parse(boText, { header: true, skipEmptyLines: true });
        setBoPreviewCount(parsed.data.length);
      } catch {
        setBoPreviewCount(null);
      }
    } else {
      setBoPreviewCount(null);
    }
  }, [boFile, boText]);

  // Inspect work orders CSV preview
  useEffect(() => {
    if (woFile) {
      woFile.text().then(text => {
        try {
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
          setWoPreviewCount(parsed.data.length);
        } catch {
          setWoPreviewCount(null);
        }
      });
    } else if (woText.trim()) {
      try {
        const parsed = Papa.parse(woText, { header: true, skipEmptyLines: true });
        setWoPreviewCount(parsed.data.length);
      } catch {
        setWoPreviewCount(null);
      }
    } else {
      setWoPreviewCount(null);
    }
  }, [woFile, woText]);

  // Unified Multi-File Ingestion & Auto-Detection Handler
  const processMultiFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.name.endsWith('.csv') || f.type.includes('csv') || f.type.includes('text'));
    if (fileArray.length === 0) return;

    setStatusMsg(null);
    const logs: string[] = [];

    for (const file of fileArray) {
      try {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, { header: true, preview: 5, skipEmptyLines: true });
        const headers = parsed.meta.fields || [];
        const detectedType = classifyCsv(headers, file.name);

        const fullParsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rowCount = fullParsed.data.length;

        if (detectedType === 'BACKORDERS') {
          setBoFile(file);
          setBoText('');
          logs.push(`✓ Auto-detected Backorders: "${file.name}" (${rowCount} rows)`);
        } else if (detectedType === 'WORK_ORDERS') {
          setWoFile(file);
          setWoText('');
          logs.push(`✓ Auto-detected Work Orders: "${file.name}" (${rowCount} orders)`);
        }
      } catch (err) {
        console.error('Failed to parse file for auto-detection:', file.name, err);
      }
    }

    setAutoDetectedLogs(logs);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMultiFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processMultiFiles(e.target.files);
    }
  };

  // Parsing Helpers
  const parseBackorderCsv = (csvContent: string): RawBackorderItem[] => {
    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true
    });

    return parsed.data.map((row, idx) => {
      const getVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          const matchKey = Object.keys(row).find(rk => {
            const cleanRk = rk.trim().toLowerCase().replace(/\s+/g, ' ');
            const cleanK = k.trim().toLowerCase().replace(/\s+/g, ' ');
            return cleanRk === cleanK;
          });
          if (matchKey && row[matchKey] !== undefined && row[matchKey].trim() !== '') {
            return row[matchKey].trim();
          }
        }
        return '';
      };

      const backOrderQty = parseFloat(getVal(['Back Order Qty', 'BO Qty', 'Qty', 'Backorder Quantity'])) || 0;
      const backOrderValue = parseFloat(getVal(['Back Order Value', 'BO Value', 'Value'])) || 0;

      return {
        id: `upload-bo-${idx}-${Date.now()}`,
        customerName: getVal(['Customer Name', 'Customer', 'Client']),
        salesOrderNumber: getVal(['Sales Order Number', 'Sales Order', 'SO Number', 'SO#']),
        orderDate: getVal(['Order Date', 'Sales Order Date', 'SO Date', 'Date', 'Tran Date', 'Transaction Date', 'Date Created', 'Order Placed', 'Date Entered']),
        description: getVal(['Description', 'Item Description']),
        item: getVal(['Item', 'Part #', 'Part Number', 'SKU']),
        location: getVal(['Location', 'Warehouse', 'Site']),
        status: getVal(['Status', 'Order Status']),
        backOrderQty,
        backOrderValue,
        brand: getVal(['Brand', 'Manufacturer']),
        type: getVal(['Type', 'Item Type']),
        netstockIndicator: getVal([
          'Netstock Stocking Indicator Sydney',
          'Netstock Indicator',
          'Netstock',
          'Stocking Indicator'
        ]),
        stockRequiredBy: getVal(['Stock Required by', 'Required Date', 'Stock Required Date']),
        expectedShipDate: getVal(['Expected Ship Date', 'Ship Date', 'Expected Ship'])
      };
    });
  };

  const parseWorkOrderCsv = (csvContent: string): RawWorkOrder[] => {
    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: true
    });

    return parsed.data.map((row, idx) => {
      const getVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          const matchKey = Object.keys(row).find(rk => {
            const cleanRk = rk.trim().toLowerCase().replace(/\s+/g, ' ');
            const cleanK = k.trim().toLowerCase().replace(/\s+/g, ' ');
            return cleanRk === cleanK;
          });
          if (matchKey && row[matchKey] !== undefined && row[matchKey].trim() !== '') {
            return row[matchKey].trim();
          }
        }
        return '';
      };

      const partNumber = getVal(['Part #', 'Part Number', 'Item', 'SKU', 'Assembly']);
      let woNumbers = getVal([
        'WO Numbers',
        'WO #',
        'Work Order #',
        'WO Number',
        'TranID',
        'Tran ID',
        'Document Number',
        'Doc #',
        'Ref #'
      ]);

      if (!woNumbers || woNumbers === 'Unnumbered WO') {
        const cleanPart = partNumber ? partNumber.replace(/[^a-zA-Z0-9-]/g, '') : 'SYS';
        woNumbers = `WO-${cleanPart}-${String(idx + 1).padStart(2, '0')}`;
      }

      return {
        partNumber,
        scheduledQty: parseFloat(getVal(['Scheduled Qty', 'WO Qty', 'Qty', 'Scheduled Quantity', 'Quantity'])) || 0,
        earliestWOStart: getVal(['Earliest WO Start', 'WO Start Date', 'Start Date', 'Date', 'Earliest WO Start Date']),
        woNumbers
      };
    });
  };

  // Execute Import & Apply Data
  const handleProcessUpload = async () => {
    try {
      setIsProcessing(true);
      setStatusMsg(null);

      let boData: RawBackorderItem[] = [];
      let woData: RawWorkOrder[] = [];

      // Parse Backorders
      if (boFile) {
        const text = await boFile.text();
        boData = parseBackorderCsv(text);
      } else if (boText.trim()) {
        boData = parseBackorderCsv(boText);
      }

      // Parse Work Orders
      if (woFile) {
        const text = await woFile.text();
        woData = parseWorkOrderCsv(text);
      } else if (woText.trim()) {
        woData = parseWorkOrderCsv(woText);
      }

      if (boData.length === 0 && woData.length === 0) {
        setIsProcessing(false);
        setStatusMsg({
          type: 'error',
          text: 'Please select or paste at least one CSV dataset to import.'
        });
        return;
      }

      // Calculate summary metrics
      const uniqueSkus = new Set(boData.map(b => b.item.trim()).filter(Boolean));
      const totalBoQty = boData.reduce((sum, b) => sum + (Number(b.backOrderQty) || 0), 0);
      const totalBoValue = boData.reduce((sum, b) => sum + (Number(b.backOrderValue) || 0), 0);

      const summary: UploadSummary = {
        backordersCount: boData.length,
        workOrdersCount: woData.length,
        uniqueSkusCount: uniqueSkus.size,
        totalBoQty,
        totalBoValue,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      await new Promise(resolve => setTimeout(resolve, 350));

      onApplyUploadedData(boData, woData, summary);
      setIsProcessing(false);
      setCompletedSummary(summary);
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMsg({
        type: 'error',
        text: `Error parsing CSV: ${err.message || err}`
      });
    }
  };

  const handleResetForNewUpload = () => {
    setCompletedSummary(null);
    setBoFile(null);
    setWoFile(null);
    setBoText('');
    setWoText('');
    setBoPreviewCount(null);
    setWoPreviewCount(null);
    setAutoDetectedLogs([]);
    setStatusMsg(null);
  };

  const totalDatasetsAttached = (boFile || boText.trim() ? 1 : 0) + (woFile || woText.trim() ? 1 : 0);

  const suiteqlBackorderQuery = `-- NetSuite SuiteQL: Open Backorders & Customer Demand Export
SELECT 
  t.tranid AS "Sales Order Number",
  TO_CHAR(t.trandate, 'DD/MM/YYYY') AS "Order Date",
  c.companyname AS "Customer Name",
  i.itemid AS "Item",
  i.displayname AS "Description",
  tl.quantitybackordered AS "Back Order Qty",
  ROUND(tl.quantitybackordered * NVL(tl.rate, 0), 2) AS "Back Order Value",
  TO_CHAR(NVL(tl.expectedshipdate, t.trandate), 'DD/MM/YYYY') AS "Stock Required by",
  TO_CHAR(NVL(tl.expectedshipdate, t.trandate), 'DD/MM/YYYY') AS "Expected Ship Date",
  loc.name AS "Location",
  NVL(i.custitem_netstock_indicator, 'Stocked') AS "Netstock Stocking Indicator Sydney"
FROM 
  transaction t
  INNER JOIN transactionLine tl ON t.id = tl.transaction
  INNER JOIN item i ON tl.item = i.id
  LEFT JOIN entity c ON t.entity = c.id
  LEFT JOIN location loc ON tl.location = loc.id
WHERE 
  t.type = 'SalesOrd' 
  AND tl.mainline = 'F'
  AND tl.isclosed = 'F'
  AND tl.quantitybackordered > 0
ORDER BY 
  NVL(tl.expectedshipdate, t.trandate) ASC;`;

  const suiteqlWorkOrderQuery = `-- NetSuite SuiteQL: Active Work Orders Schedule Export
SELECT 
  i.itemid AS "Part #",
  t.tranid AS "WO #",
  tl.quantity AS "Scheduled Qty",
  TO_CHAR(t.startdate, 'DD/MM/YYYY') AS "Earliest WO Start"
FROM 
  transaction t
  INNER JOIN transactionLine tl ON t.id = tl.transaction
  INNER JOIN item i ON tl.item = i.id
WHERE 
  t.type = 'WorkOrd'
  AND tl.mainline = 'T'
  AND t.status IN ('Pending Build', 'In Process', 'A', 'B')
ORDER BY 
  t.startdate ASC;`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuery(label);
    setTimeout(() => setCopiedQuery(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 text-slate-100 rounded-2xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 transition-all relative my-auto">
        
        {/* Modal Top Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
              <Layers className="w-5.5 h-5.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                Import CSV Reports & Datasets
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                Upload Backorder Report and Work Orders (Auto-detects format)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* State 1: Upload Completed View */}
        {completedSummary ? (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-950/80 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">
                CSV Datasets Imported Successfully!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Parsed and linked into the priority calculation engine at <span className="font-semibold text-slate-200">{completedSummary.timestamp}</span>.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Backorders
                </span>
                <span className="text-lg font-extrabold font-mono text-amber-400">
                  {completedSummary.backordersCount}
                </span>
                <span className="text-[10px] text-slate-500 block">Demand lines</span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Work Orders
                </span>
                <span className="text-lg font-extrabold font-mono text-blue-400">
                  {completedSummary.workOrdersCount}
                </span>
                <span className="text-[10px] text-slate-500 block">Schedules</span>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Value
                </span>
                <span className="text-lg font-extrabold font-mono text-emerald-400">
                  ${Math.round(completedSummary.totalBoValue).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">Export demand</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleResetForNewUpload}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Upload Additional CSVs</span>
              </button>

              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>View Updated Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Active CSV Upload Interface */
          <div className="space-y-5">
            
            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  statusMsg.type === 'error'
                    ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                    : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* 1. Unified Multi-file Drag & Drop Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => dropzoneInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition-all cursor-pointer relative ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-700/80 bg-slate-900/40 hover:bg-slate-800/40 hover:border-amber-500/70'
              }`}
            >
              <input
                ref={dropzoneInputRef}
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="space-y-2">
                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center mx-auto shadow-inner">
                  <FileUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-slate-100 font-semibold text-sm sm:text-base">
                    Drop your CSV report file(s) here, or click to select
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Supports <strong className="text-slate-200">Backorders</strong> and <strong className="text-slate-200">Work Orders</strong> (Auto-detects format)
                  </p>
                </div>
              </div>
            </div>

            {/* Auto-detected Files Log Banner */}
            {autoDetectedLogs.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-detection summary:</span>
                </div>
                <div className="space-y-0.5 text-[11px] text-amber-200/90 font-mono">
                  {autoDetectedLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 my-2">
              <div className="h-px bg-slate-800 flex-1"></div>
              <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-slate-500 uppercase px-1">
                OR MANAGE INDIVIDUAL DATASETS
              </span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </div>

            {/* 2 Individual Dataset Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              
              {/* Card 1: Backorders */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-xs sm:text-sm leading-tight">
                          1. Backorders
                        </h4>
                        <span className="text-[11px] text-slate-400 block">Sales order demand</span>
                      </div>
                    </div>
                    {(boFile || boText.trim()) ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full">
                        Attached ✓
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Optional</span>
                    )}
                  </div>

                  {/* Active File / Status Tag */}
                  {boFile ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between mt-2">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-200 truncate block text-[11px]">
                          {boFile.name}
                        </span>
                        {boPreviewCount !== null && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {boPreviewCount} lines detected
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setBoFile(null); setBoPreviewCount(null); }}
                        className="text-slate-500 hover:text-slate-300 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : showBoPaste ? (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        rows={3}
                        value={boText}
                        onChange={e => setBoText(e.target.value)}
                        placeholder="Paste Backorders CSV text..."
                        className="w-full p-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80"
                      />
                      {boPreviewCount !== null && (
                        <div className="text-[10px] text-emerald-400 font-mono">
                          {boPreviewCount} lines parsed
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Card 1 Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex-1 py-2 px-3 text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 rounded-xl transition-all text-center cursor-pointer">
                    Choose File
                    <input
                      type="file"
                      accept=".csv"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setBoFile(file);
                          setBoText('');
                          setShowBoPaste(false);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowBoPaste(!showBoPaste)}
                    className="px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-amber-400 underline transition-colors"
                  >
                    Paste
                  </button>
                </div>
              </div>

              {/* Card 2: Work Orders */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-all shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-xs sm:text-sm leading-tight">
                          2. Work Orders
                        </h4>
                        <span className="text-[11px] text-slate-400 block">Factory production runs</span>
                      </div>
                    </div>
                    {(woFile || woText.trim()) ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full">
                        Attached ✓
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Optional</span>
                    )}
                  </div>

                  {/* Active File / Status Tag */}
                  {woFile ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between mt-2">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-200 truncate block text-[11px]">
                          {woFile.name}
                        </span>
                        {woPreviewCount !== null && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {woPreviewCount} orders detected
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setWoFile(null); setWoPreviewCount(null); }}
                        className="text-slate-500 hover:text-slate-300 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : showWoPaste ? (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        rows={3}
                        value={woText}
                        onChange={e => setWoText(e.target.value)}
                        placeholder="Paste Work Orders CSV text..."
                        className="w-full p-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/80"
                      />
                      {woPreviewCount !== null && (
                        <div className="text-[10px] text-emerald-400 font-mono">
                          {woPreviewCount} orders parsed
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Card 2 Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex-1 py-2 px-3 text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 rounded-xl transition-all text-center cursor-pointer">
                    Choose File
                    <input
                      type="file"
                      accept=".csv"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setWoFile(file);
                          setWoText('');
                          setShowWoPaste(false);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowWoPaste(!showWoPaste)}
                    className="px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-amber-400 underline transition-colors"
                  >
                    Paste
                  </button>
                </div>
              </div>

            </div>

            {/* Collapsible NetSuite SuiteQL drawer */}
            {showSuiteQL && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 text-xs mt-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-amber-400" />
                    <span>NetSuite SuiteQL Code Snippets</span>
                  </span>
                  <button
                    onClick={() => setShowSuiteQL(false)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Close
                  </button>
                </div>

                {/* Backorders Query */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">1. Backorders Demand Query</span>
                    <button
                      onClick={() => handleCopy(suiteqlBackorderQuery, 'bo')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors flex items-center gap-1"
                    >
                      {copiedQuery === 'bo' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedQuery === 'bo' ? 'Copied' : 'Copy Query'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto border border-slate-800">
                    {suiteqlBackorderQuery}
                  </pre>
                </div>

                {/* Work Orders Query */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">2. Work Orders Schedule Query</span>
                    <button
                      onClick={() => handleCopy(suiteqlWorkOrderQuery, 'wo')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors flex items-center gap-1"
                    >
                      {copiedQuery === 'wo' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedQuery === 'wo' ? 'Copied' : 'Copy Query'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto border border-slate-800">
                    {suiteqlWorkOrderQuery}
                  </pre>
                </div>
              </div>
            )}

            {/* Footer Action Bar */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowSuiteQL(!showSuiteQL)}
                className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showSuiteQL ? 'Hide NetSuite SQL Queries' : 'NetSuite SuiteQL Queries'}</span>
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800/80 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessUpload}
                  disabled={isProcessing}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-amber-400/10 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Parsing & Loading...</span>
                    </>
                  ) : totalDatasetsAttached > 0 ? (
                    <>
                      <span>Import {totalDatasetsAttached} Dataset{totalDatasetsAttached > 1 ? 's' : ''}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Select or Drop File to Import</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
