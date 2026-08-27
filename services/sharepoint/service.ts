import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";

type GraphPage<T> = { value: T[]; "@odata.nextLink"?: string };
export type SharePointFile = {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  size: number;
  file?: { mimeType?: string };
  parentReference?: { driveId?: string; siteId?: string; path?: string };
};

export class SharePointService {
  constructor(private readonly graph: MicrosoftGraphClient) {}

  async recentFiles() {
    return this.graph.request<GraphPage<SharePointFile>>("/me/drive/recent?$top=50");
  }

  async resolveSite(hostname: string, sitePath: string) {
    return this.graph.request<{ id: string; displayName: string; webUrl: string }>(
      `/sites/${hostname}:/${sitePath.replace(/^\//, "")}`,
    );
  }

  async rootFiles(siteId: string) {
    return this.graph.request<GraphPage<SharePointFile>>(
      `/sites/${encodeURIComponent(siteId)}/drive/root/children?$top=200`,
    );
  }
}
