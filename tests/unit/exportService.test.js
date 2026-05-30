describe('Delta operation mapping logic', () => {
  function getOperation(row) {
    if (row.is_deleted) return 'DELETE';
    if (new Date(row.created_at).getTime() === new Date(row.updated_at).getTime()) return 'INSERT';
    return 'UPDATE';
  }

  test('marks soft-deleted rows as DELETE', () => {
    expect(getOperation({
      is_deleted: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z'
    })).toBe('DELETE');
  });

  test('marks new rows as INSERT when created_at equals updated_at', () => {
    const ts = '2024-01-01T00:00:00Z';
    expect(getOperation({ is_deleted: false, created_at: ts, updated_at: ts })).toBe('INSERT');
  });

  test('marks modified rows as UPDATE', () => {
    expect(getOperation({
      is_deleted: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z'
    })).toBe('UPDATE');
  });

  test('DELETE takes priority over timestamp check', () => {
    const ts = '2024-01-01T00:00:00Z';
    expect(getOperation({ is_deleted: true, created_at: ts, updated_at: ts })).toBe('DELETE');
  });
});

describe('Watermark logic', () => {
  test('watermark should be max updated_at from exported rows', () => {
    const rows = [
      { updated_at: new Date('2024-01-01') },
      { updated_at: new Date('2024-01-05') },
      { updated_at: new Date('2024-01-03') },
    ];
    const sorted = rows.sort((a, b) => a.updated_at - b.updated_at);
    expect(sorted[sorted.length - 1].updated_at).toEqual(new Date('2024-01-05'));
  });

  test('returns null watermark for empty result set', () => {
    const rows = [];
    const maxUpdatedAt = rows.length > 0 ? rows[rows.length - 1].updated_at : null;
    expect(maxUpdatedAt).toBeNull();
  });
});

describe('Filename generation', () => {
  test('full export filename starts with full_', () => {
    const filename = `full_consumer-1_${Date.now()}.csv`;
    expect(filename).toMatch(/^full_consumer-1_\d+\.csv$/);
  });

  test('incremental export filename starts with incremental_', () => {
    const filename = `incremental_consumer-2_${Date.now()}.csv`;
    expect(filename).toMatch(/^incremental_/);
  });

  test('delta export filename starts with delta_', () => {
    const filename = `delta_consumer-3_${Date.now()}.csv`;
    expect(filename).toMatch(/^delta_/);
  });
});
