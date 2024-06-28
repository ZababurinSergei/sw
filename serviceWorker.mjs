const isWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;

let accessHandle = null

function getClientList() {
    return self.clients.claim().then(() =>
        self.clients.matchAll({
            type: 'window'
        })
    );
}

self.addEventListener("message", async (event) => {
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle("config", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(event.data.message);
    await writable.close();
})

async function getHandleFromPath(path = '') {
    const pathParts = path.split('/').filter(part => part.length > 0);
    let currentHandle = await navigator.storage.getDirectory();

    for (const part of pathParts) {
        if (part === '..') {
            currentHandle = await currentHandle.getParent();
        } else {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
    }

    return currentHandle;
}

async function getFileHandleFromPath(path = '') {
    const pathParts = path.split('/').filter(part => part.length > 0);
    const fileName = pathParts.pop();
    const dirHandle = await getHandleFromPath(pathParts.join('/'));
    return await dirHandle.getFileHandle(fileName);
}

async function getFileAccessHandle(fileHandle = '') {
    if (isWorker) {
        // return  await fileHandle.createSyncAccessHandle();
        return fileHandle;
    } else {
        return fileHandle;
    }
}

async function readFile(fileName = '', destination = '') {
    const fileHandle = await getFileHandleFromPath(fileName);
    // const accessHandle = await getFileAccessHandle(fileHandle);

    let fileSize;
    let buffer;
    const file = await fileHandle.getFile();

    // if(destination !== 'font') {
    //     return await file.arrayBuffer()
    // } else {
        // if (isWorker) {
        //     fileSize = accessHandle.getSize();
        //     buffer = new DataView(new ArrayBuffer(fileSize));
        //     accessHandle.read(buffer, { at: 0 });
        //     accessHandle.close();
        // } else {

        fileSize = file.size;
        buffer = new Uint8Array(fileSize);
        await file.arrayBuffer().then(data => buffer.set(new Uint8Array(data)));
        // }

        return new Uint8Array(buffer.buffer);
    // }
}

// always install updated SW immediately
self.addEventListener('install', async event => {
    self.skipWaiting();
});

self.addEventListener('activate', async event => {
    const clients = await getClientList()
    clients.forEach(client => {
        client.postMessage({
            type: 'SW_ACTIVATED'
        })
    })
});

const createStream = (uint) => new ReadableStream({
    start(controller) {
        controller.enqueue(uint)
        controller.close()
    }
})

const getHeaders = (destination, path) => {
    let options = {
        status: 200,
        statusText: 'OK'
    };

    switch (destination) {
        case 'style':
            options.headers = new Headers({
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                'Content-Type': 'text/css; charset=UTF-8'
            });
            break;
        case 'script':
            options.headers = new Headers({
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                'Content-Type': 'application/javascript; charset=UTF-8'
            });
            break;
        case 'document':
            options.headers = new Headers({
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                'Content-Type': 'text/html; charset=UTF-8'
            });
            break
        case 'image':
            const isWebp = path.endsWith('.webp')
            const isJpeg = path.endsWith('.jpg') || path.endsWith('.jpeg')
            const isPng = path.endsWith('.png')

            options.headers = new Headers({
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                'Content-Type': isWebp? 'image/webp': isJpeg? 'image/jpeg': isPng? 'image/png':'image/svg+xml'
            });
            break;
        case 'font':
            let contentType = ''

            if(path.includes('.ttf')) {
                contentType = 'font/ttf'
            } else {
                console.error('неизвестный Content-Type', path)
            }

            options.headers = new Headers({
                'Transfer-Encoding': 'chunked',
                'Content-Type': contentType,
                'Vary': 'Accept-Encoding',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=0'
            });
            break;
        default:
            options.headers = new Headers({
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Opener-Policy": "same-origin",
                'Content-Type': 'text/html; charset=UTF-8'
            });
            break;
    }

    return options
};

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    let destination = event.request.destination;

    // const isSw = event.request.referrer.includes('/sw/')
    let isSw = url.pathname.includes('/sw/')
    const isService = url.pathname.includes('/welcomebook/')
    const isExternal = !event.request.url.startsWith('https://zababurinsergei.github.io/')

    if(!isSw) {
        console.log('dddd', event.request.url);
        // console.log('ddddddddddddddddddddddddd',location, event.request,  url.pathname)
    }

    console.log('----------------------- 1 -------------------------', isSw || isService, url.pathname !== '/DevOps/sw/', url.pathname !==  '/DevOps/', !isExternal)
    if((isSw || isService) && url.pathname !==  '/DevOps/sw/index.sw.html'&& url.pathname !== '/DevOps/sw/' && url.pathname !==  '/DevOps/' && !isExternal) {
        const isBrowser = isSw || url.pathname.includes('swagger-initializer.mjs')
            || url.pathname.includes('/api/idKey')
            || url.pathname.includes('/api/ansis')
            || url.pathname.includes('/api/swagger')
            || url.pathname.includes('/mss.yaml')
            || url.pathname.includes('/api/index.css')
            || url.pathname.includes('/api/swagger-ui.css')
            || url.pathname.includes('/api/swagger-ui.css')
            || url.pathname.includes('/api/swagger-ui.css')

        console.log('---------------------- 1 - 2 --------------------------',isBrowser || isService,  url.pathname)

        if ((isBrowser || isService) && !url.pathname.includes('git-upload-pack') && !url.pathname.includes('info/refs') || url.pathname.includes('/idKey/') || url.pathname.includes('/ansis/') || url.pathname.includes('/store/')) {

            event.respondWith((async () => {
                const servicePath = await readFile('config')
                const string = textDecoder.decode(servicePath)

                const path =  `${string}${url.pathname}`
                // const path = isBrowser
                //     ? `${string}/docs${url.pathname.replace('DevOps/sw/', '')}`
                //     : `${string}${url.pathname}`

                const options = getHeaders(destination, path)

                console.log('---------------------- 1 - 2 - 3 --------------------------', path)
                if(isBrowser) {
                    try {
                        console.log('---------------------- 1 - 2 - 3 & 4 --------------------------', path)
                        const file = await readFile(path);
                        return new Response(file, options)
                    } catch (e) {
                        let pathname = url.pathname.replace('/DevOps/sw/', '')
                        pathname = pathname.replaceAll("%20",' ')
                        const path = `${string}${pathname}`
                        console.log('---------------------- 1 - 2 - 3 & 5 --------------------------', path)
                        const file =  await readFile(path)
                        return new Response(file, options)
                    }
                } else {
                    console.log('---------------------- 1 - 2 - 3 & 6 --------------------------', path)
                    return new Response(await readFile(path), options)
                }
            }) ());
        }
    } else {
        if(!isExternal) {
            console.log('---------------------- 1 - 7 --------------------------', url.pathname)
            event.respondWith(
                fetch(event.request)
                    .then(function (response) {
                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                        const moddedResponse = new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: newHeaders,
                        });

                        return moddedResponse;
                    })
                    .catch(function (e) {
                        console.error(e);
                    })
            );
        } else {
            console.log('---------------------- 1 - 8 --------------------------', url.pathname)
        }
    }
});