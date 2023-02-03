export class RequestBody {
    url: string | undefined;
}

export class ShortUrl {
    url: string

    constructor(url: string) {
        this.url = url;
    }
}
