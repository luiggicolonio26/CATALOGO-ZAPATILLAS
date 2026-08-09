import { NextResponse } from 'next/server';
import { getCatalog, saveCatalog } from '@/lib/store';
import { ValidationError, parseZapatillaInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = parseZapatillaInput(body);
    const items = await getCatalog();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Ese par ya no existe en el catálogo.' }, { status: 404 });
    }
    const updatedItem = { ...items[idx], ...parsed };
    const updated = [...items];
    updated[idx] = updatedItem;
    await saveCatalog(updated, items);
    return NextResponse.json({ item: updatedItem });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'No se pudieron guardar los cambios.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const items = await getCatalog();
    const exists = items.some((i) => i.id === id);
    if (!exists) {
      return NextResponse.json({ error: 'Ese par ya no existe en el catálogo.' }, { status: 404 });
    }
    const updated = items.filter((i) => i.id !== id);
    await saveCatalog(updated, items);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'No se pudo eliminar el par.' }, { status: 500 });
  }
}
