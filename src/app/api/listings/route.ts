export const runtime = 'edge';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

interface Listing {
  id: string;
  type: 'yacht' | 'car' | 'stay' | 'experience';
  title: string;
  city: string;
  region: string;
  price: number | null;
  priceUnit: string;
  capacity: number | null;
  splitPrice: number | null;
  splitCount: number;
  rating: number | null;
  reviewCount: number | null;
  photoUrls: string[];
  features: string[];
  source: string;
}

async function queryTable(table: string, select: string, filters: Record<string, string> = {}): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let all: any[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    url.searchParams.set('is_active', 'eq.true');
    for (const [k, v] of Object.entries(filters)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set('order', 'id');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      if (!res.ok) break;
      const rows: any[] = await res.json();
      all = all.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    } catch {
      break;
    }
  }

  return all;
}

function normalizeBoat(row: any): Listing {
  const capacity = row.capacity || 8;
  return {
    id: row.id, type: 'yacht',
    title: row.name || 'Yacht Charter',
    city: row.city || '', region: row.region || '',
    price: row.hourly_rate, priceUnit: '/hr', capacity,
    splitPrice: row.hourly_rate ? Math.round(row.hourly_rate / capacity) : null,
    splitCount: capacity,
    rating: row.rating ? parseFloat(row.rating) : null,
    reviewCount: row.review_count ? parseInt(row.review_count) : null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [...(row.amenities || []), ...(row.features || [])].filter(Boolean).slice(0, 4),
    source: 'boatsetter',
  };
}

function normalizeMvpYacht(row: any): Listing {
  const capacity = row.cruising_capacity || 12;
  return {
    id: row.id, type: 'yacht',
    title: row.name || 'Yacht Charter',
    city: row.city || '', region: row.region || '',
    price: null, priceUnit: '', capacity,
    splitPrice: null, splitCount: capacity,
    rating: null, reviewCount: null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [row.length_feet ? `${row.length_feet}ft` : null, row.builder, row.cruising_capacity ? `Up to ${row.cruising_capacity} guests` : null].filter(Boolean),
    source: 'mvpmiami',
  };
}

function normalizeCar(row: any): Listing {
  const capacity = 4;
  return {
    id: row.id, type: 'car',
    title: row.title || `${row.year || ''} ${row.make || ''} ${row.model || ''}`.trim(),
    city: row.city || '', region: row.region || '',
    price: row.daily_rate, priceUnit: '/day', capacity,
    splitPrice: row.daily_rate ? Math.round(row.daily_rate / capacity) : null,
    splitCount: capacity,
    rating: null, reviewCount: null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [row.horsepower ? `${row.horsepower} HP` : null, row.zero_to_sixty ? `0-60: ${row.zero_to_sixty}s` : null, row.top_speed ? `${row.top_speed} mph` : null, row.transmission].filter(Boolean).slice(0, 4),
    source: row.source_provider || 'unknown',
  };
}

function normalizeMansion(row: any): Listing {
  const capacity = row.capacity || 8;
  return {
    id: row.id, type: 'stay',
    title: row.name || 'Luxury Stay',
    city: row.city || '', region: row.region || '',
    price: row.nightly_rate, priceUnit: '/night', capacity,
    splitPrice: row.nightly_rate ? Math.round(row.nightly_rate / capacity) : null,
    splitCount: capacity,
    rating: null, reviewCount: null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [row.bedrooms ? `${row.bedrooms} bed` : null, row.bathrooms ? `${row.bathrooms} bath` : null, ...(row.amenities || [])].filter(Boolean).slice(0, 4),
    source: 'mvpmiami',
  };
}

function normalizeStay(row: any): Listing {
  const capacity = row.max_guests || 4;
  return {
    id: row.id, type: 'stay',
    title: row.title || 'Luxury Stay',
    city: row.city || '', region: row.region || '',
    price: row.nightly_rate, priceUnit: '/night', capacity,
    splitPrice: row.nightly_rate ? Math.round(row.nightly_rate / capacity) : null,
    splitCount: capacity,
    rating: row.rating ? parseFloat(row.rating) : null,
    reviewCount: row.review_count ? parseInt(row.review_count) : null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [row.property_type, row.bedrooms ? `${row.bedrooms} bed` : null, row.is_superhost ? 'Superhost' : null, ...(row.amenities || [])].filter(Boolean).slice(0, 4),
    source: 'airbnb',
  };
}

function normalizeExperience(row: any): Listing {
  const capacity = row.max_guests || 10;
  return {
    id: row.id, type: 'experience',
    title: row.title || 'Experience',
    city: row.city || '', region: row.region || '',
    price: row.price_amount, priceUnit: '/person', capacity,
    splitPrice: row.price_amount ? Math.round(row.price_amount) : null,
    splitCount: 1,
    rating: row.rating ? parseFloat(row.rating) : null,
    reviewCount: row.review_count ? parseInt(row.review_count) : null,
    photoUrls: (row.photo_urls || []).slice(0, 5),
    features: [row.category, row.duration_minutes ? `${Math.round(row.duration_minutes / 60)}h` : null, row.host_name ? `Hosted by ${row.host_name}` : null].filter(Boolean).slice(0, 4),
    source: 'airbnb',
  };
}

function scoreListing(l: Listing): number {
  let score = 0;
  if (l.photoUrls.length > 0) score += 10;
  if (l.photoUrls.length > 2) score += 3;
  if (l.rating && l.rating >= 4) score += 5;
  if (l.price) score += 3;
  if (l.reviewCount && l.reviewCount > 5) score += 2;
  score += Math.random() * 2;
  return score;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category') || 'all';
  const city = url.searchParams.get('city') || '';
  const sort = url.searchParams.get('sort') || 'featured';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24'), 48);

  const cityFilter: Record<string, string> = {};
  if (city) cityFilter.city = `ilike.*${city}*`;

  const queries: Promise<Listing[]>[] = [];

  if (category === 'all' || category === 'yacht') {
    queries.push(
      queryTable('boats', 'id,name,city,region,hourly_rate,capacity,rating,review_count,photo_urls,amenities,features', cityFilter).then(rows => rows.map(normalizeBoat)),
      queryTable('mvp_yachts', 'id,name,city,region,cruising_capacity,photo_urls,length_feet,builder', cityFilter).then(rows => rows.map(normalizeMvpYacht)),
    );
  }
  if (category === 'all' || category === 'car') {
    queries.push(
      queryTable('exotic_cars', 'id,title,year,make,model,city,region,daily_rate,photo_urls,horsepower,zero_to_sixty,top_speed,transmission,source_provider', cityFilter).then(rows => rows.map(normalizeCar)),
    );
  }
  if (category === 'all' || category === 'stay') {
    queries.push(
      queryTable('mansions', 'id,name,city,region,nightly_rate,capacity,photo_urls,amenities,bedrooms,bathrooms', cityFilter).then(rows => rows.map(normalizeMansion)),
      queryTable('airbnb_stays', 'id,title,city,region,nightly_rate,max_guests,rating,review_count,photo_urls,bedrooms,property_type,is_superhost,amenities', cityFilter).then(rows => rows.map(normalizeStay)),
    );
  }
  if (category === 'all' || category === 'experience') {
    queries.push(
      queryTable('airbnb_experiences', 'id,title,city,region,price_amount,max_guests,rating,review_count,photo_urls,category,duration_minutes,host_name', cityFilter).then(rows => rows.map(normalizeExperience)),
    );
  }

  const results = await Promise.all(queries);
  let listings = results.flat();
  listings = listings.filter(l => l.photoUrls.length > 0);

  switch (sort) {
    case 'price_asc':
      listings.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
      break;
    case 'price_desc':
      listings.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'rating':
      listings.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    default:
      listings.sort((a, b) => scoreListing(b) - scoreListing(a));
  }

  const total = listings.length;
  const offset = (page - 1) * limit;
  const paginated = listings.slice(offset, offset + limit);
  const cities = [...new Set(listings.map(l => l.city).filter(Boolean))].sort();

  return new Response(JSON.stringify({ listings: paginated, total, page, perPage: limit, cities }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
