// Vercel Serverless Function: POST /api/submit
// 1. Creates a record in Airtable with the text fields.
// 2. Uploads each attached file (PDF/photos) to that record via Airtable's
//    content upload endpoint.

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

async function createRecord(fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to create Airtable record");
  }
  return data; // contains data.id
}

async function uploadAttachment(recordId, fieldName, file) {
  if (!file || !file.base64) return;

  const res = await fetch(
    `https://content.airtable.com/v0/${BASE_ID}/${recordId}/${encodeURIComponent(
      fieldName
    )}/uploadAttachment`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: file.contentType,
        filename: file.filename,
        file: file.base64,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Failed to upload attachment for ${fieldName}`
    );
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE_NAME) {
    return res.status(500).json({ error: "Server missing Airtable configuration" });
  }

  try {
    const {
      name,
      date,
      venue,
      coordinator,
      description,
      photosLink,
      fundDetails,
      attendancePdf,
      eventPoster,
      photo1,
      photo2,
      photo3,
    } = req.body;

    // Step 1: create the record with text fields only
    const record = await createRecord({
      Name: name || "",
      Date: date || undefined, // omit if empty so Airtable doesn't error on date parsing
      Venue: venue || "",
      Coordinator: coordinator || "",
      Description: description || "",
      "Photos link": photosLink || "",
      "Fund Details": fundDetails || "",
    });

    const recordId = record.id;

    // Step 2: upload attachments one at a time (Airtable processes these sequentially per record)
    if (attendancePdf) await uploadAttachment(recordId, "Attendance PDF", attendancePdf);
    if (eventPoster)   await uploadAttachment(recordId, "Event Poster",   eventPoster);
    if (photo1) await uploadAttachment(recordId, "Photo 1", photo1);
    if (photo2) await uploadAttachment(recordId, "Photo 2", photo2);
    if (photo3) await uploadAttachment(recordId, "Photo 3", photo3);
    if (fundDetails) await uploadAttachment(recordId, "Fund Details", fundDetails)

    return res.status(200).json({ success: true, recordId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// Vercel functions default to a 4.5MB body limit — bump it a bit for base64-encoded files.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};