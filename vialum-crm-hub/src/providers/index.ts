import { registerProvider } from './provider.registry.js';
import { PipedriveProvider } from './pipedrive/pipedrive.provider.js';
import { ClickUpProvider } from './clickup/clickup.provider.js';
import { GDriveProvider } from './gdrive/gdrive.provider.js';
import { RDStationProvider } from './rdstation/rdstation.provider.js';

export function initProviders(): void {
  registerProvider(new PipedriveProvider());
  registerProvider(new ClickUpProvider());
  registerProvider(new GDriveProvider());
  registerProvider(new RDStationProvider());
}
