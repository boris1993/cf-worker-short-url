export class RequestBody {
    url: string | undefined;
}

export class ResponseBody {
    key: string

    constructor(key: string) {
        this.key = key;
    }
}

export class ShortUrl {
    url: string

    constructor(url: string) {
        this.url = url;
    }
}
