export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message
  };
}

export function errorResponse(error: string, message: string, statusCode = 400) {
  return {
    success: false,
    error,
    message,
    statusCode
  };
}
