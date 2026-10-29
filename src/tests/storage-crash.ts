import { OrdinaryStore } from '../main/ordinary-store';
import { randomUUID } from 'node:crypto';
void(async()=>{const store=new OrdinaryStore(process.argv[2]!,{fault:async stage=>{if(stage===process.argv[3]){process.stdout.write('ready');await new Promise(()=>{});}}});await store.open();await store.savePreference({baseRevision:0,clientMutationId:randomUUID(),privacyNotification:false});})().catch(()=>process.exit(1));
