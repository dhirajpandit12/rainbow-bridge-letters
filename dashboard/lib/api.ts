const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface Order {
  id: string;
  pet_name: string;
  owner_name: string;
  email: string;
  status: string;
  shopify_order_id: string;
  correction_note: string | null;
  created_at: string;
  generated_letter?: string | null;
  generated_reading?: Record<string, string> | null;
  pet_type?: string;
  called_you?: string;
  personality?: string;
  favorite_memory?: string;
  message_to_pet?: string;
  pet_calls_you?: string;
  photo_url?: string;
  species?: string;
  life_stage?: string;
  question?: string;
}

export interface OrdersResponse {
  rainbow: Order[];
  soul: Order[];
}

export async function fetchOrders(token: string, type: 'all' | 'rainbow' | 'soul' = 'all', status?: string): Promise<OrdersResponse> {
  const params = new URLSearchParams({ type });
  if (status) params.set('status', status);
  const res = await fetch(`${API_URL}/admin/orders?${params}`, {
    headers: { 'x-admin-token': token },
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function resendOrder(token: string, type: 'rainbow' | 'soul', orderId: string, correctionNote: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/resend`, {
    method: 'POST',
    headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, orderId, correctionNote }),
  });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to resend');
}
