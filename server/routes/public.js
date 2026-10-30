import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import db, { RESUME_STORAGE_DIR } from '../db/database.js';
import { generateSecureToken } from '../utils/crypto.js';

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // fallback when browser omits specific office mime; extension still checked strictly
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, RESUME_STORAGE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    cb(null, `${Date.now()}-${generateSecureToken(12)}${safeExt}`);
  },
});

const uploadResume = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max for zero-budget storage efficiency
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Resume/CV must be a PDF, DOC, or DOCX document (up to 5 MB).'));
    }
    return cb(null, true);
  },
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function cleanupUploadedFile(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * GET /api/public/info
 * Returns only company-approved public settings (never invents missing details).
 */
router.get('/info', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  const map = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let values = [];
  if (map.company_values_json) {
    try {
      const parsed = JSON.parse(map.company_values_json);
      if (Array.isArray(parsed)) values = parsed;
    } catch {
      values = [];
    }
  }

  return res.json({
    companyName: 'AI Square IT Solutions',
    mission: map.company_mission || null,
    vision: map.company_vision || null,
    values,
    contactEmail: map.public_contact_email || null,
    contactPhone: map.public_contact_phone || null,
    officeAddress: map.public_office_address || null,
    mapLink: map.public_map_link || null,
    mapLat: map.public_map_lat ? Number(map.public_map_lat) : null,
    mapLng: map.public_map_lng ? Number(map.public_map_lng) : null,
    privacyContactNote: map.privacy_contact_note || null,
  });
});

/**
 * GET /api/public/jobs
 * Returns ONLY published, open job openings.
 */
router.get('/jobs', (_req, res) => {
  const jobs = db
    .prepare(
      `SELECT
         id,
         title,
         employment_type AS employmentType,
         location_note AS locationNote,
         description,
         responsibilities,
         qualifications,
         skills,
         application_instructions AS applicationInstructions,
         created_at AS createdAt
       FROM jobs
       WHERE status = 'published'
       ORDER BY created_at DESC`
    )
    .all();

  return res.json({ jobs });
});

/**
 * POST /api/public/applications
 * Saves candidate job or general application with private resume upload.
 */
router.post('/applications', (req, res) => {
  uploadResume.single('resume')(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Resume file exceeds the 5 MB maximum upload limit.' });
      }
      return res.status(400).json({ error: uploadErr.message || 'Invalid resume file upload.' });
    }

    const file = req.file;
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const jobSelection = String(req.body?.jobSelection || 'general').trim();
    const educationExperience = String(req.body?.educationExperience || '').trim();
    const coverLetter = String(req.body?.coverLetter || '').trim();

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      cleanupUploadedFile(file);
      return res.status(400).json({ error: 'Please enter your full name (2–120 characters).' });
    }
    if (!isValidEmail(email)) {
      cleanupUploadedFile(file);
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!phone || phone.length < 7 || phone.length > 30 || !/^[0-9+\-() .]+$/.test(phone)) {
      cleanupUploadedFile(file);
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    if (!educationExperience || educationExperience.length < 15 || educationExperience.length > 4000) {
      cleanupUploadedFile(file);
      return res.status(400).json({
        error: 'Please provide your education and relevant experience (at least 15 characters).',
      });
    }
    if (!file) {
      return res.status(400).json({
        error: 'A Resume/CV file (.pdf, .doc, or .docx) is required to submit an application.',
      });
    }

    let jobId = null;
    let positionTitle = 'General Application — Future Opportunities';
    let isGeneral = 1;

    if (jobSelection !== 'general') {
      const parsedId = parseInt(jobSelection, 10);
      if (Number.isNaN(parsedId)) {
        cleanupUploadedFile(file);
        return res.status(400).json({ error: 'Invalid job position selected.' });
      }
      const job = db
        .prepare("SELECT id, title FROM jobs WHERE id = ? AND status = 'published'")
        .get(parsedId);
      if (!job) {
        cleanupUploadedFile(file);
        return res.status(400).json({
          error: 'The selected vacancy is no longer open for applications. Please refresh or submit a General Application.',
        });
      }
      jobId = job.id;
      positionTitle = job.title;
      isGeneral = 0;
    }

    try {
      const result = db
        .prepare(
          `INSERT INTO job_applications (
             job_id,
             position_title,
             is_general_application,
             full_name,
             email,
             phone,
             education_experience,
             resume_original_name,
             resume_stored_name,
             resume_mime_type,
             resume_size_bytes,
             cover_letter,
             status,
             created_at,
             updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', datetime('now'), datetime('now'))`
        )
        .run(
          jobId,
          positionTitle,
          isGeneral,
          fullName,
          email,
          phone,
          educationExperience,
          path.basename(file.originalname),
          file.filename,
          file.mimetype,
          file.size,
          coverLetter || null
        );

      return res.status(201).json({
        success: true,
        applicationId: result.lastInsertRowid,
        positionTitle,
        message:
          'Your application and resume have been securely saved. Authorized hiring administrators will review your submission and reach out directly if shortlisted.',
      });
    } catch (err) {
      cleanupUploadedFile(file);
      return res.status(500).json({ error: 'Unable to save application right now. Please try again.' });
    }
  });
});

/**
 * POST /api/public/contact
 * Saves a business or general enquiry to persistent storage.
 */
router.post('/contact', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || name.length < 2 || name.length > 120) {
    return res.status(400).json({ error: 'Please enter your name (2–120 characters).' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!subject || subject.length < 3 || subject.length > 180) {
    return res.status(400).json({ error: 'Please enter a subject (3–180 characters).' });
  }
  if (!message || message.length < 10 || message.length > 5000) {
    return res.status(400).json({ error: 'Please enter a message of at least 10 characters.' });
  }

  const result = db
    .prepare(
      `INSERT INTO contact_messages (name, email, subject, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'unread', datetime('now'), datetime('now'))`
    )
    .run(name, email, subject, message);

  return res.status(201).json({
    success: true,
    enquiryId: result.lastInsertRowid,
    message:
      'Thank you. Your enquiry has been saved and routed to the AI Square IT Solutions management team.',
  });
});

export default router;
