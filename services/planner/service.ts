import { MicrosoftGraphClient } from "@/services/microsoft-graph/client";
type Page<T>={value:T[];"@odata.nextLink"?:string};
export type PlannerTask={id:string;planId:string;bucketId:string;title:string;percentComplete:number;priority:number;startDateTime?:string;dueDateTime?:string;assignments:Record<string,unknown>;"@odata.etag"?:string};
export class PlannerService{constructor(private graph:MicrosoftGraphClient){} getPlans(groupId:string){return this.graph.request<Page<{id:string;title:string}>>(`/groups/${groupId}/planner/plans`);} getBuckets(planId:string){return this.graph.request<Page<{id:string;name:string;planId:string}>>(`/planner/plans/${planId}/buckets`);} getTasks(planId:string){return this.graph.request<Page<PlannerTask>>(`/planner/plans/${planId}/tasks`);} getTaskDetails(taskId:string){return this.graph.request<{description:string;references:Record<string,unknown>;checklist:Record<string,unknown>}>(`/planner/tasks/${taskId}/details`);}}

