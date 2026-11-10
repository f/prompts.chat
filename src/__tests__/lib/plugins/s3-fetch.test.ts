import { describe, it, expect, vi, afterEach } from "vitest";
import { deleteObject, putObject, signS3Request } from "@/lib/plugins/storage/s3-fetch";

// The "GET Object" example from AWS's Signature Version 4 documentation for S3
const AWS_EXAMPLE_CREDENTIALS = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
};

describe("signS3Request", () => {
  it("reproduces AWS's published example signature", async () => {
    const headers = await signS3Request({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: { Range: "bytes=0-9" },
      credentials: AWS_EXAMPLE_CREDENTIALS,
      date: new Date("2013-05-24T00:00:00Z"),
    });

    expect(headers).toEqual({
      range: "bytes=0-9",
      "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "x-amz-date": "20130524T000000Z",
      authorization:
        "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
        "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    });
  });
});

describe("putObject / deleteObject", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a signed PUT with the content type and ACL", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const url = new URL("https://bucket.nyc3.digitaloceanspaces.com/prompt-media/a.jpg");
    await putObject(url, new TextEncoder().encode("hello"), AWS_EXAMPLE_CREDENTIALS, {
      contentType: "image/jpeg",
      acl: "public-read",
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(calledUrl).toBe(url);
    expect(init.method).toBe("PUT");
    expect(headers["content-type"]).toBe("image/jpeg");
    expect(headers["x-amz-acl"]).toBe("public-read");
    expect(headers["x-amz-content-sha256"]).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(headers.authorization).toMatch(/SignedHeaders=content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date,/);
  });

  it("throws with the status when the store refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<Error>AccessDenied</Error>", { status: 403 })));

    await expect(deleteObject(new URL("https://bucket.s3.us-east-1.amazonaws.com/k"), AWS_EXAMPLE_CREDENTIALS)).rejects.toThrow(
      /S3 DELETE \/k failed with 403: <Error>AccessDenied/
    );
  });
});
