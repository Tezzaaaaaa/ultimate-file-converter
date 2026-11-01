import {
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilmIcon,
  ImageIcon,
  MusicIcon,
  PresentationIcon,
} from 'lucide-react';

import type { FileKind } from '@/lib/formats';

const icons = {
  Audio: MusicIcon,
  Video: FilmIcon,
  Image: ImageIcon,
  Document: FileTextIcon,
  Spreadsheet: FileSpreadsheetIcon,
  Presentation: PresentationIcon,
  File: FileIcon,
};

export function KindIcon({
  kind,
  className,
}: {
  kind: FileKind;
  className?: string;
}) {
  const Icon = icons[kind] ?? FileIcon;
  return <Icon className={className} aria-hidden="true" />;
}
