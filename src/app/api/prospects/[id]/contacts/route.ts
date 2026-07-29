import { NextResponse } from 'next/server';
import { dbService, Prospect } from '@/lib/db';
import { geminiService } from '@/lib/gemini';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prospectId = id;

    const contacts = await dbService.getContactsForProspect(prospectId);
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error fetching contacts' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prospectId = id;

    const prospect: Prospect | undefined = await dbService.getProspectById(prospectId);

    if (!prospect) {
      return NextResponse.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Extract fields safely for geminiService
    const companyOrName = prospect.company_name;
    const website = prospect.website || '';

    // Trigger Gemini search for contacts
    const decisionMakers = await geminiService.findDecisionMakers(companyOrName, website);

    // Save discovered contacts to database
    const savedContacts = [];
    if (Array.isArray(decisionMakers)) {
      for (const dm of decisionMakers) {
        const added = await dbService.addContactForProspect(prospectId, {
          name: dm.name,
          email: dm.email,
          role: dm.role,
          phone: dm.phone,
        });
        savedContacts.push(added);
      }
    }

    return NextResponse.json({ success: true, contacts: savedContacts });
  } catch (error: any) {
    console.error('Error discovering contacts:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
