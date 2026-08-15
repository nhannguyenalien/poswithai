class ApiError implements Exception {
  const ApiError({
    required this.code,
    required this.message,
    this.details,
    this.statusCode,
    this.requestId,
  });

  final String code;
  final String message;
  final Object? details;
  final int? statusCode;
  final String? requestId;

  factory ApiError.fromJson(
    Map<String, dynamic> json, {
    int? statusCode,
    String? requestId,
  }) {
    return ApiError(
      code: json['code'] as String? ?? 'UNKNOWN_ERROR',
      message:
          json['message'] as String? ??
          json['error'] as String? ??
          'Đã có lỗi xảy ra',
      details: json['details'],
      statusCode: statusCode,
      requestId: requestId,
    );
  }

  @override
  String toString() => message;
}
