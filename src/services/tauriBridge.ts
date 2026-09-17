// AgenticOS Tauri IPC Bridge Service
// Provides seamless invocation of Tauri backend commands with graceful fallback to
// the local streaming backend service when running in browser / dev mode.

export interface TauriDownloadOptions {
  repo: string;
  version: string;
  asset_name: string;
  direct_url?: string;
  destination_dir?: string;
  expected_sha256?: string;
  expected_size?: number;
}

export interface TauriDownloadResult {
  success: boolean;
  asset_name: string;
  file_path: string;
  temporary_path: string;
  downloaded_bytes: number;
  content_length?: number;
  sha256: string;
  expected_sha256?: string;
  checksum_match: boolean;
  content_type: string;
  atomic_rename_success: boolean;
  info_sidecar_prevented: boolean;
  duration_ms: number;
  transfer_rate_mbps: number;
  message: string;
}

export class TauriBridge {
  private static instance: TauriBridge;

  public static getInstance(): TauriBridge {
    if (!TauriBridge.instance) {
      TauriBridge.instance = new TauriBridge();
    }
    return TauriBridge.instance;
  }

  /**
   * Detects if the frontend is executing inside a Tauri desktop runtime container.
   */
  public isTauriRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).__TAURI_INTERNALS__ ||
      (window as any).__TAURI__ ||
      (window as any).__TAURI_METADATA__
    );
  }

  /**
   * Invokes the Tauri backend command `download_github_release_asset` using reqwest streaming.
   * Enforces binary-only handling, content-length validation, direct streaming to .tmp,
   * atomic file system rename, and explicit sidecar (.info) file prevention.
   */
  public async downloadReleaseAsset(
    options: TauriDownloadOptions
  ): Promise<TauriDownloadResult> {
    // 1. If running in native Tauri runtime, use Tauri's IPC invoke channel
    if (this.isTauriRuntime()) {
      try {
        const tauriCore = (window as any).__TAURI_INTERNALS__;
        if (tauriCore && typeof tauriCore.invoke === 'function') {
          return await tauriCore.invoke('download_github_release_asset', { options });
        }
        const globalTauri = (window as any).__TAURI__;
        if (globalTauri?.core?.invoke) {
          return await globalTauri.core.invoke('download_github_release_asset', { options });
        }
      } catch (err: any) {
        console.warn('[TauriBridge] Native IPC invoke failed, falling back to local streaming endpoint:', err);
      }
    }

    // 2. Fallback / Dev Server: Call the local backend streaming endpoint
    const queryParams = new URLSearchParams({
      asset_name: options.asset_name,
      repo: options.repo,
      version: options.version,
    });
    if (options.destination_dir) queryParams.set('destination_dir', options.destination_dir);
    if (options.expected_sha256) queryParams.set('expected_sha256', options.expected_sha256);
    if (options.expected_size) queryParams.set('expected_size', options.expected_size.toString());

    const res = await fetch(`/api/tauri/download_release_asset?${queryParams.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
      throw new Error(errJson.error || `Download failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      success: data.success ?? true,
      asset_name: data.asset || options.asset_name,
      file_path: data.finalPath || `downloads/${options.asset_name}`,
      temporary_path: data.temporaryPath || `downloads/${options.asset_name}.tmp`,
      downloaded_bytes: data.downloadedBytes,
      content_length: data.expectedBytes,
      sha256: data.sha256,
      expected_sha256: data.expectedSha256,
      checksum_match: data.checksumMatch,
      content_type: data.contentType,
      atomic_rename_success: data.atomicRenameSuccess ?? true,
      info_sidecar_prevented: data.infoSidecarPrevented ?? true,
      duration_ms: data.durationMs,
      transfer_rate_mbps: data.transferRateMbps,
      message: data.message || 'Streamed directly to .tmp with atomic rename. No .info sidecar files created.',
    };
  }
}

export const tauriBridge = TauriBridge.getInstance();
