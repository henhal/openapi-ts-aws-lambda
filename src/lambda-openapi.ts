import * as Lambda from 'aws-lambda';

import {OneOrMany, OpenApi, OperationParams, RawRequest, RawResponse, RequestParams, StringParams} from '@openapi-ts/backend';

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
  return Object.fromEntries(Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, Array.isArray(v) && v.length === 1 ? v[0] : v])) as StringParams;
}

function fromLambdaEvent(event: Lambda.APIGatewayEvent): RawRequest {
  return {
    method: event.httpMethod,
    path: event.path,
    query: toStringParams({
      ...event.queryStringParameters,
      ...event.multiValueQueryStringParameters
    }),
    headers: toStringParams({
      ...event.headers,
      ...event.multiValueHeaders
    }),
    body: parseJson(event.body),
  };
}

function toLambdaResult(res: RawResponse): Lambda.APIGatewayProxyResult {
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

/**
 * AWS Lambda specific request parameters
 * @property event    The Lambda event
 * @property context  The Lambda context
 */
export type LambdaSource = {
  lambda: {
    event: Lambda.APIGatewayEvent;
    context: Lambda.Context;
  };
};

export type LambdaOperationParams<T = any> = OperationParams<LambdaSource & T>;

export type LambdaRequestParams<T = any> = RequestParams<LambdaSource & T>;

export function eventHandler<T>(api: OpenApi<any>, ...args: T[]): Lambda.APIGatewayProxyHandler {
  const [data] = args;

  return async (event: Lambda.APIGatewayEvent, context: Lambda.Context) => {
    api.logger.debug(`Lambda event:\n${JSON.stringify(event, null, 2)}`);

    const res = await api.handleRequest(
        fromLambdaEvent(event),
        {
          lambda: {
            event,
            context
          },
          ...data
        });

    return toLambdaResult(res);
  }
}

/**
 * A HTTP API using an OpenAPI definition and implemented using AWS Lambda.
 */
export class LambdaOpenApi<T> extends OpenApi<LambdaSource & T> {
  /**
   * Creates a lambda HTTP event handler function which will route and handle requests using this class
   * and transform the response into a lambda HTTP event response.
   * The request and response body will be converted from/to JSON.
   *
   * @param args  If T is an object, an instance of T, otherwise no parameters
   *
   * @return A lambda event handler function
   */
  eventHandler(...args: T[]): Lambda.APIGatewayProxyHandler {
    return eventHandler(this, ...args);
  }
}
