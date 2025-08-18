import React, { useEffect, useState } from 'react';

interface UserRow {
  id: string;
  email?: string;
  role: 'admin' | 'user' | 'blocked';
  is_whitelisted?: boolean;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { users: UserRow[] };
      setUsers(data.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, changes: Partial<UserRow>) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', payload: { id, ...changes } }),
    });
    if (res.ok) load();
  };

  if (loading) return <div className="p-4 text-sm">Loading users…</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-lg font-semibold">Admin: User Management</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-bolt-elements-textSecondary">
            <tr>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Whitelisted</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-bolt-elements-borderColor">
                <td className="py-2 pr-3 font-mono text-xs max-w-[200px] truncate">{u.id}</td>
                <td className="py-2 pr-3">{u.email || '—'}</td>
                <td className="py-2 pr-3">
                  <select
                    className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded px-2 py-1"
                    value={u.role}
                    onChange={(e) => update(u.id, { role: e.currentTarget.value as UserRow['role'] })}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="blocked">blocked</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={!!u.is_whitelisted}
                    onChange={(e) => update(u.id, { is_whitelisted: e.currentTarget.checked })}
                  />
                </td>
                <td className="py-2 pr-3">
                  <button
                    className="px-2 py-1 text-red-600 hover:bg-red-600/10 rounded"
                    onClick={async () => {
                      const res = await fetch('/api/admin/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', payload: { id: u.id } }),
                      });
                      if (res.ok) load();
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
