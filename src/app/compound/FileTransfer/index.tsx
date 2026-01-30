import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/** ---------- Types ---------- */

export type ExportFormat = 'json' | 'csv';
export type ImportFormat = 'json' | 'csv';

export type ImportStatus = 'idle' | 'picking' | 'reading' | 'parsing' | 'done' | 'error';

export type ImportProgress = {
  status: ImportStatus;
  /** 0..100 */
  percent: number;
  fileName?: string;
  error?: string;
};

export type ExportRequest<T extends object = object> = {
  data: T[];
  suggestedFileName?: string; // without extension is fine too
};

export type ImportResult<T extends object = object> = {
  format: ImportFormat;
  fileName: string;
  rawText: string;
  data: T[];
};

export type FileTransferContextType<T extends object = object> = {
  /** set when you click an ExportWrapper */
  pendingExport?: ExportRequest<T> | null;

  /** call this from your popup once user picks json/csv */
  exportAs: (format: ExportFormat, opts?: { fileName?: string }) => void;

  /** wrapper calls it to stage export data */
  requestExport: (req: ExportRequest<T>) => void;

  /** open file picker and parse file */
  importFile: (opts?: { accept?: ImportFormat[] }) => Promise<ImportResult<T> | null>;

  /** import progress for your UI */
  importProgress: ImportProgress;

  /** last successful or failed result (failed: data empty + error in progress) */
  lastImportResult?: ImportResult<T> | null;

  /** clear staged stuff */
  clearPendingExport: () => void;
  clearLastImport: () => void;
};

/** ---------- Context ---------- */

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const FileTransferContext = createContext<FileTransferContextType<any>>(undefined!);
FileTransferContext.displayName = 'FileTransferContext';

export function useFileTransfer<T extends object = object>() {
  const ctx = useContext(FileTransferContext) as FileTransferContextType<T>;
  if (ctx === undefined) {
    throw new Error('useFileTransfer must be used within a <FileTransferProvider />');
  }
  return ctx;
}

/** ---------- Helpers ---------- */

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // small delay so Safari doesn’t sometimes cancel it
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function ensureExt(name: string, ext: string) {
  const normalized = name.trim() || 'export';
  return normalized.toLowerCase().endsWith(`.${ext}`) ? normalized : `${normalized}.${ext}`;
}

function escapeCsvCell(v: unknown) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // escape quotes by doubling them, wrap in quotes if needed
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function objectsToCsv<T extends object>(rows: T[]) {
  if (!rows.length) return '';

  // union of keys across all rows (stable: keys from first row first, then new ones)
  const seen = new Set<string>();
  const headers: string[] = [];
  const addKey = (k: string) => {
    if (!seen.has(k)) {
      seen.add(k);
      headers.push(k);
    }
  };

  Object.keys(rows[0] as any).forEach(addKey);
  for (let i = 1; i < rows.length; i++) {
    Object.keys(rows[i] as any).forEach(addKey);
  }

  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(','));

  for (const row of rows) {
    const line = headers.map(h => escapeCsvCell((row as any)[h])).join(',');
    lines.push(line);
  }

  // CRLF is friendlier for Excel
  return lines.join('\r\n');
}

function csvToObjects(csvText: string): Record<string, string>[] {
  // simple CSV parser (handles quotes, commas, newlines)
  // returns all values as strings; you can coerce later if needed
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  // last cell
  row.push(cell);
  rows.push(row);

  // trim possible trailing empty row
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();

  if (!rows.length) return [];

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);

  return dataRows
    .filter(r => r.some(c => c !== ''))
    .map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = r[idx] ?? '';
      });
      return obj;
    });
}

function detectFormat(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

function readFileAsTextWithProgress(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = evt => {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 100);
        onProgress(percent);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result ?? ''));

    reader.readAsText(file);
  });
}

/** ---------- Provider ---------- */

export function FileTransferProvider<T extends object>({ children }: { children: React.ReactNode }) {
  const [pendingExport, setPendingExport] = useState<ExportRequest<T> | null>(null);
  const [lastImportResult, setLastImportResult] = useState<ImportResult<T> | null>(null);

  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    percent: 0
  });

  // hidden input for picking files (reuse it)
  const inputRef = useRef<HTMLInputElement | null>(null);

  const requestExport = useCallback((req: ExportRequest<T>) => {
    setPendingExport(req);
  }, []);

  const clearPendingExport = useCallback(() => setPendingExport(null), []);
  const clearLastImport = useCallback(() => setLastImportResult(null), []);

  const exportAs = useCallback(
    (format: ExportFormat, opts?: { fileName?: string }) => {
      if (!pendingExport?.data) {
        throw new Error('No pending export data. Call requestExport first.');
      }

      const baseName =
        opts?.fileName ?? pendingExport.suggestedFileName ?? `contacts_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'json') {
        const pretty = JSON.stringify(pendingExport.data, null, 2);
        const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, ensureExt(baseName, 'json'));
      } else {
        const csv = objectsToCsv(pendingExport.data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, ensureExt(baseName, 'csv'));
      }
    },
    [pendingExport]
  );

  const ensureInput = useCallback(() => {
    if (inputRef.current) return inputRef.current;

    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);
    inputRef.current = input;

    return input;
  }, []);

  const importFile = useCallback(
    async (opts?: { accept?: ImportFormat[] }) => {
      const accept = opts?.accept?.length ? opts.accept : ['json', 'csv'];

      setImportProgress({ status: 'picking', percent: 0 });
      const input = ensureInput();
      input.accept = accept.map(f => `.${f}`).join(',');
      input.value = ''; // allow re-picking same file

      const file = await new Promise<File | null>(resolve => {
        const handler = () => {
          input.removeEventListener('change', handler);
          resolve(input.files?.[0] ?? null);
        };
        input.addEventListener('change', handler);
        input.click();
      });

      if (!file) {
        setImportProgress({ status: 'idle', percent: 0 });
        return null;
      }

      const format = detectFormat(file.name);
      if (!format || !accept.includes(format)) {
        setImportProgress({
          status: 'error',
          percent: 0,
          fileName: file.name,
          error: 'Unsupported file type'
        });
        return null;
      }

      setImportProgress({ status: 'reading', percent: 0, fileName: file.name });

      let rawText = '';
      try {
        rawText = await readFileAsTextWithProgress(file, p => {
          setImportProgress(prev => ({
            ...prev,
            status: 'reading',
            percent: Math.min(99, Math.max(prev.percent, p)) // keep < 100 until parsed
          }));
        });
      } catch (e: any) {
        setImportProgress({
          status: 'error',
          percent: 0,
          fileName: file.name,
          error: e?.message ?? 'Failed to read file'
        });
        return null;
      }

      setImportProgress({ status: 'parsing', percent: 99, fileName: file.name });

      try {
        let data: any[] = [];

        if (format === 'json') {
          const parsed = JSON.parse(rawText);
          if (!Array.isArray(parsed)) {
            throw new Error('JSON must be an array of objects');
          }
          data = parsed;
        } else {
          data = csvToObjects(rawText);
        }

        const result: ImportResult<T> = {
          format,
          fileName: file.name,
          rawText,
          data
        };

        setLastImportResult(result);
        setImportProgress({ status: 'done', percent: 100, fileName: file.name });
        return result;
      } catch (e: any) {
        setImportProgress({
          status: 'error',
          percent: 0,
          fileName: file.name,
          error: e?.message ?? 'Failed to parse file'
        });
        return null;
      }
    },
    [ensureInput]
  );

  const value = useMemo<FileTransferContextType<T>>(
    () => ({
      pendingExport,
      requestExport,
      exportAs,
      importFile,
      importProgress,
      lastImportResult,
      clearPendingExport,
      clearLastImport
    }),
    [
      pendingExport,
      requestExport,
      exportAs,
      importFile,
      importProgress,
      lastImportResult,
      clearPendingExport,
      clearLastImport
    ]
  );

  return <FileTransferContext.Provider value={value}>{children}</FileTransferContext.Provider>;
}

/** ---------- Wrappers (compound pieces) ---------- */

type WrapperChild = React.ReactElement;

function cloneWithOnClick(child: WrapperChild, onClick: React.MouseEventHandler) {
  const existing = child.props?.onClick as React.MouseEventHandler | undefined;

  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      existing?.(e);
      if (e.defaultPrevented) return;
      onClick(e);
    }
  });
}

export function FileExportWrapper<T extends object>({
  children,
  data,
  suggestedFileName,
  onClick
}: {
  children: WrapperChild;
  data: T[];
  suggestedFileName?: string;
  /** if you want to open your popup right after staging export */
  onClick?: () => void;
}) {
  const { requestExport } = useFileTransfer<T>();

  return cloneWithOnClick(children, () => {
    requestExport({ data, suggestedFileName });
    onClick?.();
  });
}

export function FileImportWrapper<T extends object>({
  children,
  accept = ['json', 'csv'],
  onImported,
  onClick
}: {
  children: WrapperChild;
  accept?: ImportFormat[];
  onImported?: (result: ImportResult<T>) => void;
  /** if you want extra UI action before opening picker */
  onClick?: () => void;
}) {
  const { importFile } = useFileTransfer<T>();

  return cloneWithOnClick(children, async () => {
    onClick?.();
    const result = await importFile({ accept });
    if (result) onImported?.(result);
  });
}

/** ---------- Optional: helpers to mount a "headless" export trigger ---------- */

export function useFileExportActions<T extends object = object>() {
  const { pendingExport, exportAs, clearPendingExport } = useFileTransfer<T>();
  return { pendingExport, exportAs, clearPendingExport };
}

export function useFileImportState<T extends object = object>() {
  const { importProgress, lastImportResult, clearLastImport } = useFileTransfer<T>();
  return { importProgress, lastImportResult, clearLastImport };
}
