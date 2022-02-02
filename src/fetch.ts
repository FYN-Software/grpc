import { connect, constants } from 'node:http2';

export class NodeBody implements Body
{
    readonly #body?: ReadableStream<Uint8Array>;
    #bodyUsed: boolean = false;

    constructor(body?: BodyInit|null)
    {
        if(body === null || body === undefined)
        {
            body = new ReadableStream<Uint8Array>({
                start(controller: ReadableStreamDefaultController<Uint8Array>)
                {
                    controller.enqueue(new Uint8Array(0));
                    controller.close();
                },
            });
        }
        else if(body instanceof Uint8Array)
        {
            body = new ReadableStream<Uint8Array>({
                start(controller: ReadableStreamDefaultController<Uint8Array>)
                {
                    controller.enqueue(body as Uint8Array);
                    controller.close();
                },
            });
        }

        this.#body = body as ReadableStream<Uint8Array>;
    }

    public get body()
    {
        return this.#body ?? null;
    }

    public get bodyUsed()
    {
        return this.#bodyUsed;
    }

    public async arrayBuffer(): Promise<ArrayBuffer>
    {
        return this.#consume();
    }

    public async blob(): Promise<Blob>
    {
        return new Blob(
            [ await this.#consume() ],
            { type: '' }
        );
    }

    public async formData(): Promise<FormData>
    {
        return Promise.resolve(new FormData());
    }

    public async json(): Promise<any>
    {
        return JSON.parse(await this.text());
    }

    public async text(): Promise<string>
    {
        return new TextDecoder('utf-8').decode(await this.#consume());
    }

    public clone(): Body
    {
        return new NodeBody(this.#body);
    }

    async #consume(): Promise<Uint8Array>
    {
        if(this.#bodyUsed === true)
        {
            // throw new TypeError(`body already used`);
        }

        this.#bodyUsed = true;

        if(this.#body === undefined)
        {
            return new Uint8Array(0);
        }

        const reader = this.#body.getReader();

        if(reader === undefined)
        {
            return new Uint8Array(0);
        }

        let size = 0;
        const chunks: Uint8Array[] = [];

        try
        {
            while (true)
            {
                const { done, value } = await reader.read();

                if(done)
                {
                    break;
                }

                size += value!.length;
                chunks.push(value!);
            }
        }
        finally
        {
            reader.releaseLock();
        }

        const buffer = new Uint8Array(size);

        chunks.reduce((pos: number, frame: Uint8Array) => {
            buffer.set(frame, pos);

            return pos + frame.length;
        }, 0);

        return buffer
    }
}

// export class NodeHeaders implements Headers
// {
//     public append(name: string, value: string): void
//     {
//     }
//
//     public delete(name: string): void
//     {
//     }
//
//     public forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void
//     {
//     }
//
//     public get(name: string): string | null
//     {
//         return null;
//     }
//
//     public has(name: string): boolean
//     {
//         return false;
//     }
//
//     public set(name: string, value: string): void
//     {
//     }
//
//     public [Symbol.iterator](): IterableIterator<[ string, string ]>
//     {
//         return undefined;
//     }
//
//     public entries(): IterableIterator<[ string, string ]>
//     {
//         return undefined;
//     }
//
//     public keys(): IterableIterator<string>
//     {
//         return undefined;
//     }
//
//     public values(): IterableIterator<string>
//     {
//         return undefined;
//     }
// }

export class NodeRequest extends NodeBody implements Request
{
    readonly #cache: RequestCache = 'default';
    readonly #credentials: RequestCredentials = 'same-origin';
    readonly #destination: RequestDestination = '';
    readonly #headers: Headers = new Headers();
    readonly #integrity: string = '';
    readonly #keepalive: boolean = false;
    readonly #method: string = '';
    readonly #mode: RequestMode = 'cors';
    readonly #redirect: RequestRedirect = 'follow';
    readonly #referrer: string;
    readonly #referrerPolicy: ReferrerPolicy = 'same-origin';
    readonly #signal: AbortSignal;
    readonly #url: URL;

    constructor(input: RequestInfo, init: RequestInit = {})
    {
        init = {
            method: 'GET',
            ...(init ?? {})
        };

        if([ 'GET', 'HEAD' ].includes(init.method!.toUpperCase()))
        {
            throw new Error(`Request with GET/HEAD method cannot have body`);
        }

        super(init.body ?? (input as Request).body);

        this.#url = input instanceof Request
            ? new URL(input.url)
            : new URL(input);
        this.#cache = init.cache ?? (input as Request).cache ?? 'default';
        this.#credentials = init.credentials ?? (input as Request).credentials ?? 'same-origin';
        this.#headers =  new Headers(init.headers ?? (input as Request).headers ?? {});
        this.#integrity = init.integrity ?? (input as Request).integrity ?? '';
        this.#keepalive = init.keepalive ?? (input as Request).keepalive ?? false;
        this.#method = init.method ?? (input as Request).method ?? 'GET';
        this.#mode = init.mode ?? (input as Request).mode ?? 'cors';
        this.#redirect = init.redirect ?? (input as Request).redirect ?? 'follow';
        this.#referrer = init.referrer ?? (input as Request).referrer ?? 'same-origin';
        this.#referrerPolicy = init.referrerPolicy ?? (input as Request).referrerPolicy;
        this.#signal = init.signal ?? (input as Request).signal;
        this.#referrer = init.referrer ?? (input as Request).referrer ?? 'no-referrer';
    }

    public get cache(): RequestCache
    {
        return this.#cache;
    }
    public get credentials(): RequestCredentials
    {
        return this.#credentials;
    }
    public get destination(): RequestDestination
    {
        return this.#destination;
    }
    public get headers(): Headers
    {
        return this.#headers;
    }
    public get integrity(): string
    {
        return this.#integrity;
    }
    public get keepalive(): boolean
    {
        return this.#keepalive;
    }
    public get method(): string
    {
        return this.#method;
    }
    public get mode(): RequestMode
    {
        return this.#mode;
    }
    public get redirect(): RequestRedirect
    {
        return this.#redirect;
    }
    public get referrer(): string
    {
        return this.#referrer;
    }
    public get referrerPolicy(): ReferrerPolicy
    {
        return this.#referrerPolicy;
    }
    public get signal(): AbortSignal
    {
        return this.#signal;
    }
    public get url(): string
    {
        return this.#url.toString();
    }

    public clone(): Request
    {
        return new NodeRequest(this);
    }
}

const redirectStatusCodes = [301, 302, 303, 307, 308];
export class NodeResponse extends NodeBody implements Response
{
    readonly #headers: Headers;
    #counter: number = 0;
    readonly #status: number;
    readonly #statusText: string;
    #type: ResponseType = 'default';
    #url: string = '';

    constructor(body?: BodyInit, init?: ResponseInit)
    {
        super(body);

        this.#headers = new Headers(init?.headers ?? {});
        this.#status = init?.status ?? 200;
        this.#statusText = init?.statusText ?? '';
    }

    public get headers(): Headers
    {
        return this.#headers;
    }
    public get ok(): boolean
    {
        return this.#status >= 200 && this.#status < 300;
    }
    public get redirected(): boolean
    {
        return this.#counter > 0;
    }
    public get status(): number
    {
        return this.#status;
    }
    public get statusText(): string
    {
        return this.#statusText;
    }
    public get type(): ResponseType
    {
        return this.#type;
    }
    public get url(): string
    {
        return this.#url;
    }

    public clone(): Response
    {
        return new NodeResponse(this.body ?? undefined, {
            headers: this.#headers,
            status: this.#status,
            statusText: this.#statusText,
        });
    }

    public static error(): Response
    {
        return new Response(undefined, { status: 0, statusText: '' });
    }

    public static redirect(url: string|URL, status: number = 302): Response
    {
        if(redirectStatusCodes.includes(status) === false)
        {
            throw new Error(
                `Failed to execute "redirect" on "response": status '${status}' is not a valid, must be one of ${JSON.stringify(redirectStatusCodes)}`
            );
        }

        return new Response(undefined, {
            headers: {
                location: new URL(url).toString(),
            },
            status,
        });
    }
}

export async function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
{
    const request = new Request(input, init);
    const url = new URL(request.url);
    const encoder = new TextEncoder();

    const headers: Record<string, string> = {
        [constants.HTTP2_HEADER_SCHEME]: 'https',
        [constants.HTTP2_HEADER_METHOD]: request.method,
        [constants.HTTP2_HEADER_PATH]: url.pathname,
    };

    for(const [ k, v ] of request.headers.entries())
    {
        headers[k] = v;
    }

    const client = connect(request.url);
    const req = client.request(headers);
    req.setEncoding('utf-8');

    const resultStream = new ReadableStream<Uint8Array>({
        start(controller: ReadableStreamDefaultController<Uint8Array>)
        {
            req.on('data', chunk => controller.enqueue(encoder.encode(chunk)));
            req.on('end', () => {
                controller.close();
                client.close();
            });
        },
    });

    const reader = request.body?.getReader();

    if(reader !== undefined)
    {
        try
        {
            while(true)
            {
                const { done, value } = await reader.read();

                if(done)
                {
                    break;
                }

                req.write(Buffer.from(value!));
            }
        }
        finally
        {
            reader.releaseLock();
        }
    }

    req.end();

    return new Response(resultStream);
}