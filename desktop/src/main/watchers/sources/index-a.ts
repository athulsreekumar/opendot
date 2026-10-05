import { folderSource } from "./folder";
import { localWebhookSource } from "./local-webhook";
import { rssSource } from "./rss";
import { scheduleSource } from "./schedule";
import { urlSource } from "./url";

export const SOURCES_A = [scheduleSource, folderSource, urlSource, rssSource, localWebhookSource];
