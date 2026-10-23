// OpenAPI 3 description of the API, served by Swagger UI at /api/docs.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const error = (description) => ({ description, content: json(ref('Error')) });
const auth = [{ bearerAuth: [] }];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };

const itemFields = {
  itemName: { type: 'string', maxLength: 100, example: 'Black wallet' },
  type: { type: 'string', enum: ['LOST', 'FOUND'] },
  place: { type: 'string', maxLength: 100, example: 'Algiers Central Station' },
  date: { type: 'string', format: 'date', example: '2026-10-10', description: 'When the item was lost or found (not in the future)' },
  description: { type: 'string', maxLength: 1000, example: 'Leather, has ID cards' },
  imageUrl: { type: 'string', format: 'uri' },
};
const itemBody = (required) => ({
  required: true,
  content: {
    'application/json': { schema: { type: 'object', required, properties: itemFields } },
    'multipart/form-data': {
      schema: { type: 'object', required, properties: { ...itemFields, image: { type: 'string', format: 'binary', description: 'jpeg, png, webp or gif, max 5 MB' } } },
    },
  },
});

const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, description });

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Lost & Found API',
    version: '1.0.0',
    description: 'Report lost and found items, search and filter them, update your own reports and mark items as recovered.',
  },
  servers: [{ url: '/api' }],
  tags: [{ name: 'Auth' }, { name: 'Users' }, { name: 'Items' }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Create an account',
        requestBody: { required: true, content: json({ type: 'object', required: ['name', 'phone', 'password'], properties: { name: { type: 'string', example: 'Alice' }, phone: { type: 'string', example: '0550000001' }, password: { type: 'string', minLength: 8, example: 'password123' } } }) },
        responses: { 201: { description: 'Account created', content: json(ref('AuthResult')) }, 400: error('Validation failed'), 409: error('Phone number already used') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in and get a token',
        requestBody: { required: true, content: json({ type: 'object', required: ['phone', 'password'], properties: { phone: { type: 'string', example: '0550000001' }, password: { type: 'string', example: 'password123' } } }) },
        responses: { 200: { description: 'Logged in', content: json(ref('AuthResult')) }, 400: error('Validation failed'), 401: error('Invalid phone or password') },
      },
    },
    '/users/me': {
      get: { tags: ['Users'], summary: 'Current user with their reports', security: auth, responses: { 200: { description: 'OK', content: json(ref('UserWithReports')) }, 401: error('Not authenticated') } },
    },
    '/items': {
      get: {
        tags: ['Items'], summary: 'Search and filter reported items',
        description: 'Filters combine with AND. Results are newest first.',
        parameters: [
          query('q', { type: 'string' }, 'Text search in name, description and place'),
          query('type', { type: 'string', enum: ['LOST', 'FOUND'] }),
          query('status', { type: 'string', enum: ['RECOVERED', 'NOT_RECOVERED'] }),
          query('place', { type: 'string' }, 'Text search in place'),
          query('from', { type: 'string', format: 'date' }, 'Lost/found on or after this date'),
          query('to', { type: 'string', format: 'date' }, 'Lost/found on or before this date (whole day included)'),
          query('userId', { type: 'integer' }, 'Only reports from this user'),
          query('page', { type: 'integer', default: 1, minimum: 1 }),
          query('limit', { type: 'integer', default: 20, minimum: 1, maximum: 100 }),
        ],
        responses: { 200: { description: 'OK', content: json({ type: 'object', properties: { items: { type: 'array', items: ref('Report') }, meta: ref('PageMeta') } }) }, 400: error('Invalid filter') },
      },
      post: {
        tags: ['Items'], summary: 'Report a lost or found item', security: auth,
        requestBody: itemBody(['itemName', 'type', 'place', 'date']),
        responses: { 201: { description: 'Created', content: json(ref('Report')) }, 400: error('Validation failed'), 401: error('Not authenticated'), 413: error('Image too large') },
      },
    },
    '/items/{id}': {
      get: {
        tags: ['Items'], summary: 'Item details', parameters: [idParam],
        responses: { 200: { description: 'OK', content: json(ref('ReportDetails')) }, 400: error('Invalid id'), 404: error('Not found') },
      },
      patch: {
        tags: ['Items'], summary: 'Update your own report',
        description: 'Only fields that are provided (not null and not empty) are changed.',
        security: auth, parameters: [idParam], requestBody: itemBody([]),
        responses: { 200: { description: 'Updated', content: json(ref('Report')) }, 400: error('Validation failed or nothing to update'), 401: error('Not authenticated'), 403: error('Not your report'), 404: error('Not found') },
      },
    },
    '/items/{id}/recover': {
      patch: {
        tags: ['Items'], summary: 'Mark your own item as recovered', security: auth, parameters: [idParam],
        responses: { 200: { description: 'Marked as recovered', content: json(ref('Report')) }, 401: error('Not authenticated'), 403: error('Not your report'), 404: error('Not found'), 409: error('Already recovered') },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { status: { type: 'integer' }, message: { type: 'string' }, details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } } } } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, phone: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
      AuthResult: { type: 'object', properties: { user: ref('User'), token: { type: 'string' } } },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, ...itemFields, imageUrl: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['RECOVERED', 'NOT_RECOVERED'] },
          userId: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ReportDetails: { allOf: [ref('Report'), { type: 'object', properties: { reportedBy: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, phone: { type: 'string' } } } } }] },
      UserWithReports: { allOf: [ref('User'), { type: 'object', properties: { reports: { type: 'array', items: ref('Report') } } }] },
      PageMeta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
    },
  },
};
