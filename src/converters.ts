import * as Lambda from 'aws-lambda';
import {OneOrMany, RawRequest, RawResponse, StringParams} from '@openapi-ts/backend';

function parseJson(body: string | null): any {
  // Try to parse the body as JSON. If it's malformed, we return the raw string as the body to get a useful
  // error message from the API validator.
  try {
    return body ? JSON.parse(body) : undefined;
  } catch (err) {
    return body;
  }
}

// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/50224 ¯\_(ツ)_/¯
function toStringParams(obj: Record<string, OneOrMany<string> | undefined | null>): StringParams {
  // Since headers and queries may be single or multiple, our Params are string | string[]. If multiple values are
  // provided we keep it as a string array, but if a single value is provided we keep it as a string.
  return Object.fromEntries(Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, Array.isArray(v) && v.length === 1 ? v[0] : v])) as StringParams;
}

export function fromLambdaEvent(event: Lambda.APIGatewayEvent): RawRequest {
  return {
    method: event.httpMethod,
    path: event.path,
    query: toStringParams({
      ...event.queryStringParameters,
      ...event.multiValueQueryStringParameters,
    }),
    headers: toStringParams({
      ...event.headers,
      ...event.multiValueHeaders,
    }),
    body: parseJson(event.body),
  };
}

export function toLambdaResult(res: RawResponse): Lambda.APIGatewayProxyResult {
  const statusCode = res.statusCode;
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  const body = JSON.stringify(res.body);

  // Lambda separates ordinary headers and multi value headers
  for (const [k, v] of Object.entries(res.headers)) {
    if (Array.isArray(v)) {
      multiValueHeaders[k] = v.map(x => x.toString());
    } else {
      headers[k] = v.toString();
    }
  }

  return {
    statusCode,
    headers,
    multiValueHeaders,
    body,
  };
}