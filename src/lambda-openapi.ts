import * as Lambda from 'aws-lambda';

import {OpenApi, OperationParams, RequestParams} from '@openapi-ts/backend';
import {fromLambdaEvent, toLambdaResult} from './converters';

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

/**
 * Create a Lambda APIGateway handler function used as an entry point for a Lambda function listening to HTTP events.
 * @param api OpenApi instance
 * @param args Varargs custom data of type T to attach to the params provided to each API operation handler.
 *             Only the first argument will be carried into the params. If no custom data is required, T may be unknown
 *             and no data supplied.
 */
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
   * @param args If T is an object, a single argument of type T, otherwise no arguments
   *
   * @return A lambda event handler function
   */
  eventHandler(...args: T[]): Lambda.APIGatewayProxyHandler {
    return eventHandler(this, ...args);
  }
}
