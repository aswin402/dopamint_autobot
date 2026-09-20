import { NextRequest, NextResponse } from 'next/server';

export function withLogging(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const method = request.method;
    const path = request.nextUrl.pathname;
    
    // Output incoming request log in cyan
    console.log(`\x1b[36m→\x1b[0m ${method} ${path}`);
    
    const start = performance.now();
    try {
      const response = await handler(request, context);
      const duration = Math.round(performance.now() - start);
      
      const statusColor = response.status >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`\x1b[35m←\x1b[0m ${method} ${path} ${statusColor}${response.status}\x1b[0m ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      console.log(`\x1b[31m←\x1b[0m ${method} ${path} \x1b[31m500\x1b[0m ${duration}ms`);
      throw error;
    }
  };
}
