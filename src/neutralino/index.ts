import neutralino from '@neutralinojs/lib';
neutralino.init();
import * as buntralino from 'buntralino-client';
import {taskApi} from './utils/Taskapi';
import apiConfig,{type ApiConfig} from './utils/config/apiConfig';

if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ready);
} else {
    ready();
}
async function ready(){
    await buntralino.ready;
    setTimeout(async () => {
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
        const image = document.getElementById('BuntralinoQR') as HTMLImageElement;
        image.src = apiConfig.getFullUrl()+ '/qr';
    }, 1000);
}
/*
 neutralino.os.open('URL_ADDRESS');
 (window as any).callback() => {}
*/