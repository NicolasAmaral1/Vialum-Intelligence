export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: Record<string, string>, defaults = { limit: 50, maxLimit: 200 }): PaginationParams {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(query.limit ?? String(defaults.limit), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
