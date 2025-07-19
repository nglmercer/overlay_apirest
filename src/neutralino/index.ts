import neutralino from '@neutralinojs/lib';
neutralino.init();
import * as buntralino from 'buntralino-client';
import {taskApi} from './utils/Taskapi';
import apiConfig,{type ApiConfig} from './utils/config/apiConfig';
// Sample Bun interaction
(async () => {
    await buntralino.ready;
    const TIMEOUT = {};
    const response = await Promise.race([
        buntralino.run('getURL', {
            message: 'Hello, Buntralino!'
        }),
        new Promise(resolve => setTimeout(() => resolve(TIMEOUT), 5000))
    ]);
    console.log("response", response);
    if (response){
        apiConfig.update(response as ApiConfig);
    }
    const resultApi = await taskApi.getAll('overlay');
    console.log("resultApi", resultApi);
})();

(window as any).openDocs = () => neutralino.os.open('https://buntralino.ghpages.io/');
(window as any).openNeutralinoDocs = () => neutralino.os.open('https://neutralino.js.org/docs/api/overview');
(window as any).openViteDocs = () => neutralino.os.open('https://vite.dev/guide/');
