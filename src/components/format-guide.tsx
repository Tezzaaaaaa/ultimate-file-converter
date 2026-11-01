import {
  FileArchiveIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilmIcon,
  ImageIcon,
  MusicIcon,
  PresentationIcon,
  ShieldCheckIcon,
  WifiOffIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { groupMeta, type FileKind } from '@/lib/formats';

const groupIcons: Record<string, LucideIcon> = {
  Audio: MusicIcon,
  Video: FilmIcon,
  Image: ImageIcon,
  Document: FileTextIcon,
  Spreadsheet: FileSpreadsheetIcon,
  Presentation: PresentationIcon,
  Archive: FileArchiveIcon,
};

export function FormatGuide() {
  return (
    <div id="formats" className="flex scroll-mt-20 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Supported formats</CardTitle>
          <CardDescription>
            Pick any compatible target for each file you add.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {groupMeta.map((group, index) => {
            const Icon = groupIcons[group.name];
            return (
              <div key={group.name}>
                <div className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{group.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {group.hint}
                    </span>
                  </div>
                </div>
                {index < groupMeta.length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Private by design</CardTitle>
          <CardDescription>
            Conversion happens in your browser, not on a server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Files are never uploaded. There is no account, no queue and no
              conversion backend.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ZapIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Media work runs on FFmpeg WebAssembly; documents use SheetJS,
              JSZip, pdf-lib and PDF.js.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <WifiOffIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              An internet connection is required once to load those libraries.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Good to know</CardTitle>
          <CardDescription>Limits of in-browser conversion.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Scanned PDFs are not OCR-processed, and Office-to-PDF exports keep
            readable text rather than the original page design.
          </p>
          <p className="text-xs">
            Known kinds:{' '}
            {(['Audio', 'Video', 'Image', 'Document', 'Spreadsheet', 'Presentation'] as FileKind[]).join(
              ' · ',
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
