import {
  ArrowRightIcon,
  DownloadIcon,
  CodeIcon,
  LockIcon,
  MousePointerClickIcon,
  Repeat2Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from 'lucide-react';

import { Converter } from '@/components/converter';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/use-theme';

const steps = [
  {
    icon: MousePointerClickIcon,
    title: 'Add your files',
    description: 'Drop in audio, video, images, documents or PDFs — as many as you like.',
  },
  {
    icon: SlidersHorizontalIcon,
    title: 'Choose formats',
    description: 'Every file gets its own output picker, from MP3 to DOCX to PDF.',
  },
  {
    icon: DownloadIcon,
    title: 'Download results',
    description: 'Grab files one by one or all at once. Nothing ever leaves your device.',
  },
];

export function App() {
  const { theme, setTheme } = useTheme();

  const chooseFiles = () => {
    document.getElementById('file-input')?.click();
    document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2" aria-label="Convert home">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Repeat2Icon className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">convert.</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <a href="#converter">Converter</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#formats">Formats</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="#privacy">Privacy</a>
            </Button>
          </nav>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href="https://github.com/Tezzaaaaaa/ultimate-file-converter"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View source on GitHub"
                  >
                    <CodeIcon className="size-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Source on GitHub</TooltipContent>
            </Tooltip>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        <section className="border-b">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <Badge variant="outline" className="gap-1.5 rounded-full py-1 pl-2.5 pr-3">
              <SparklesIcon className="size-3" />
              Browser-based universal converter
            </Badge>

            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Convert any file, right in your browser.
            </h1>
            <p className="mt-4 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              Media, images, documents, spreadsheets and presentations — pick an
              output format per file and convert offline-friendly, without an
              upload.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={chooseFiles}>
                <MousePointerClickIcon />
                Choose files
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#formats">
                  Supported formats
                  <ArrowRightIcon />
                </a>
              </Button>
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <LockIcon className="size-3.5" />
              Files stay on your device. No account, no server, no tracking.
            </p>
          </div>
        </section>

        <section className="border-b bg-muted/30">
          <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <step.icon className="size-4 text-muted-foreground" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{step.title}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="converter"
          className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-12"
        >
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Convert</h2>
            <p className="text-sm text-muted-foreground">
              Your queue stays in this tab. Everything is processed locally.
            </p>
          </div>
          <Converter />
        </section>
      </main>

      <footer id="privacy" className="scroll-mt-20 border-t">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex max-w-sm flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Repeat2Icon className="size-3.5" />
                </span>
                <span className="text-sm font-semibold tracking-tight">convert.</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A private, browser-based converter for media, documents,
                spreadsheets, presentations and text-based PDFs.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Built with</span>
              <span>shadcn/ui components</span>
              <span>Lucide icons</span>
              <span>FFmpeg · SheetJS · JSZip · pdf-lib · PDF.js</span>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Scanned PDFs need OCR. Office-to-PDF exports preserve readable
              text, not the original page design.
            </span>
            <span>Files never leave your device.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
