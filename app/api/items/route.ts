import { NextResponse } from 'next/server';
import { getCatalog, saveCatalog } from '@/lib/store';
import { ValidationError, parseZapatillaInput } from '@/lib/validate';
import type { Zapatilla } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getCatalog();
    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'No se pudo cargar el catálogo. Revisá la configuración de almacenamiento.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseZapatillaInput(body);
    const items = await getCatalog();
    const nuevo: Zapatilla = {
      ...parsed,
      id: crypto.randomUUID(),
      creadoEn: Date.now()
    };
    const updated = [...items, nuevo];
    await saveCatalog(updated, items);
    return NextResponse.json({ item: nuevo }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'No se pudo agregar el par.' }, { status: 500 });
  }
}
