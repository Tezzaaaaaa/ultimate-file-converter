import * as React from 'react';
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileArchiveIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';

import { KindIcon } from '@/components/file-icon';
import { FormatGuide } from '@/components/format-guide';import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  defaultOutput,
  fileKind,
  formatBytes,
  outputOptions,
  type FileKind,
} from '@/lib/formats';
import { cn } from '@/lib/utils';

type QueueItem = {
  id: string;
  file: File;
  kind: FileKind;
  output: string;
};

type ResultItem = {
  id: string;
  name: string;
  size: number;
  url: string;
};

type Status = 'idle' | 'converting' | 'done' | 'error';

let counter = 0;
const nextId = () => 'f' + ++counter;

export function Converter() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [results, setResults] = React.useState<ResultItem[]>([]);
  const [status, setStatus] = React.useState<Status>('idle');
  const [progress, setProgress] = React.useState({ value: 0, label: '' });
  const [error, setError] = React.useState('');
  const [dragging, setDragging] = React.useState(false);
  const [frameInterval, setFrameInterval] = React.useState(1);
  const resultsRef = React.useRef<ResultItem[]>([]);
  const aliveRef = React.useRef(true);

  const converting = status === 'converting';
  const hasItems = items.length > 0;
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const framesSelected = items.some((item) => item.output === 'frames');

  React.useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      resultsRef.current.forEach((result) => URL.revokeObjectURL(result.url));
    };
  }, []);

  const revokeResults = React.useCallback(() => {
    resultsRef.current.forEach((result) => URL.revokeObjectURL(result.url));
  }, []);

  const addFiles = React.useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || converting) return;
      const incoming = Array.from(fileList);
      revokeResults();
      setResults([]);
      setError('');
      setStatus('idle');
      setItems((current) => [
        ...current,
        ...incoming.map((file) => {
          const kind = fileKind(file);
          return { id: nextId(), file, kind, output: defaultOutput(kind) };
        }),
      ]);
      if (inputRef.current) inputRef.current.value = '';
    },
    [converting, revokeResults],
  );

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const setOutput = (id: string, output: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, output } : item)),
    );
  };

  const clearAll = () => {
    revokeResults();
    setItems([]);
    setResults([]);
    setStatus('idle');
    setError('');
    setProgress({ value: 0, label: '' });
    if (inputRef.current) inputRef.current.value = '';
  };

  const convert = async () => {
    if (!items.length || converting) return;

    setStatus('converting');
    setError('');
    revokeResults();
    setResults([]);
    setProgress({ value: 0, label: 'Preparing files…' });

    try {
      const { convertBatch, prepareEngine } = await import('@/lib/converter');
      const sources = items.map((item) => ({ file: item.file, output: item.output }));
      await prepareEngine(sources, (value, label) =>
        setProgress({ value, label }),
      );

      const converted = await convertBatch(sources, {
        frameInterval,
        onProgress: (value, label) => setProgress({ value, label }),
      });

      if (!aliveRef.current) return;

      const mapped = converted.map((result) => ({
        id: nextId(),
        name: result.name,
        size: result.size,
        url: URL.createObjectURL(result.blob),
      }));
      setResults(mapped);
      setProgress({
        value: 100,
        label:
          'Done — ' +
          mapped.length +
          ' file' +
          (mapped.length === 1 ? '' : 's') +
          ' converted',
      });
      setStatus('done');
    } catch (cause) {
      if (!aliveRef.current) return;
      console.error(cause);
      setError(cause instanceof Error ? cause.message : 'Conversion failed.');
      setProgress({ value: 0, label: 'Conversion failed' });
      setStatus('error');
    }
  };

  const downloadAll = () => {
    results.forEach((result, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 150);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Files
              {hasItems && (
                <Badge variant="secondary" className="tabular-nums">
                  {items.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add media, documents, spreadsheets or presentations, then pick an
              output format for each file.
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={!hasItems || converting}
              >
                <Trash2Icon />
                Clear all
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <label
              htmlFor="file-input"
              onDragOver={(event) => {
                event.preventDefault();
                if (!converting) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center transition-colors',
                'hover:border-ring hover:bg-accent/40 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
                hasItems ? 'py-6' : 'py-12',
                dragging && 'border-ring bg-accent/60',
                converting && 'pointer-events-none opacity-60',
              )}
            >
              <input
                ref={inputRef}
                id="file-input"
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => addFiles(event.target.files)}
                disabled={converting}
              />
              <span className="flex size-11 items-center justify-center rounded-full border bg-background shadow-xs transition-colors group-hover:bg-background/80">
                {hasItems ? (
                  <PlusIcon className="size-5 text-muted-foreground" />
                ) : (
                  <UploadCloudIcon className="size-5 text-muted-foreground" />
                )}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {hasItems ? 'Add more files' : 'Click to select files'}
                </span>
                <span className="text-xs text-muted-foreground">
                  or drag and drop — audio, video, images, documents, PDFs
                </span>
              </span>
            </label>

            {hasItems && (
              <>
                <Separator />
                <ScrollArea className="max-h-80 pr-1">
                  <ul className="flex flex-col">
                    {items.map((item, index) => (
                      <li key={item.id}>
                        <FileRow
                          item={item}
                          disabled={converting}
                          onOutputChange={(value) => setOutput(item.id, value)}
                          onRemove={() => removeItem(item.id)}
                        />
                        {index < items.length - 1 && <Separator />}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </>
            )}

            {framesSelected && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <Label htmlFor="frame-interval" className="text-sm font-normal">
                  Extract a frame every
                </Label>
                <Input
                  id="frame-interval"
                  type="number"
                  min={0.1}
                  max={3600}
                  step={0.1}
                  value={frameInterval}
                  onChange={(event) =>
                    setFrameInterval(Number(event.target.value))
                  }
                  disabled={converting}
                  className="h-8 w-20 bg-background"
                />
                <span className="text-sm text-muted-foreground">
                  seconds, saved as a ZIP of JPG frames
                </span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {hasItems
                ? `${items.length} file${items.length === 1 ? '' : 's'} · ${formatBytes(totalSize)} total`
                : 'No files selected yet'}
            </p>
            <Button
              onClick={convert}
              disabled={!hasItems || converting}
              className="w-full sm:w-auto"
            >
              {converting ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Converting…
                </>
              ) : (
                <>
                  {status === 'done' || status === 'error'
                    ? 'Convert again'
                    : 'Convert files'}
                  <ArrowRightIcon />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {status !== 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Progress
                <StatusBadge status={status} />
              </CardTitle>
              <CardDescription>
                {status === 'converting'
                  ? 'Processing locally in this browser tab — keep it open.'
                  : status === 'done'
                    ? 'Your converted files are ready to download.'
                    : 'Something interrupted the conversion.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {progress.label}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {Math.round(progress.value)}%
                  </span>
                </div>
                <Progress value={progress.value} />
              </div>
              {status === 'error' && error && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>Conversion failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Downloads
                <Badge variant="secondary" className="tabular-nums">
                  {results.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Saved to your device — nothing was uploaded.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  <DownloadIcon />
                  Download all
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col">
                {results.map((result, index) => (
                  <li key={result.id}>
                    <div className="flex items-center gap-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                        <FileArchiveIcon className="size-4 text-muted-foreground" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {result.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(result.size)}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={result.url} download={result.name}>
                          <DownloadIcon />
                          Download
                        </a>
                      </Button>
                    </div>
                    {index < results.length - 1 && <Separator />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <FormatGuide />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'converting')
    return (
      <Badge variant="secondary">
        <Loader2Icon className="animate-spin" />
        Working
      </Badge>
    );
  if (status === 'done')
    return (
      <Badge variant="outline">
        <CheckCircle2Icon />
        Complete
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <TriangleAlertIcon />
      Failed
    </Badge>
  );
}

function FileRow({
  item,
  disabled,
  onOutputChange,
  onRemove,
}: {
  item: QueueItem;
  disabled: boolean;
  onOutputChange: (value: string) => void;
  onRemove: () => void;
}) {
  const options = outputOptions(item.kind, item.file.name);

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
        <KindIcon kind={item.kind} className="size-4 text-muted-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium" title={item.file.name}>
          {item.file.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(item.file.size)} · {item.kind}
        </span>
      </div>
      <Select value={item.output} onValueChange={onOutputChange} disabled={disabled}>
        <SelectTrigger
          size="sm"
          className="w-[8.5rem] shrink-0 bg-background"
          aria-label={'Output format for ' + item.file.name}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground"
        onClick={onRemove}
        disabled={disabled}
        aria-label={'Remove ' + item.file.name}
      >
        <XIcon />
      </Button>
    </div>
  );
}
