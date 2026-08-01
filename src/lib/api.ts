import { supabase } from './supabase';
import type { Screenshot, Project } from './types';

/**
 * Upload a screenshot to Supabase storage and return the public URL.
 */
export async function uploadScreenshot(
  file: File,
  projectId: string,
  index: number
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${projectId}/${Date.now()}_${index}.${ext}`;

  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Create a new project in Supabase.
 */
export async function createProject(data: {
  name: string;
  appName?: string;
  templateId?: string;
  format?: 'horizontal' | 'vertical' | 'square';
}): Promise<Project> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: data.name,
      app_name: data.appName,
      template_id: data.templateId || 'clean-dark',
      format: data.format || 'horizontal',
      user_id: user.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return project;
}

/**
 * Save screenshots metadata to Supabase.
 */
export async function saveScreenshots(
  projectId: string,
  screenshots: Screenshot[]
): Promise<void> {
  const rows = screenshots.map((s, i) => ({
    project_id: projectId,
    storage_path: s.url,
    display_order: i,
    caption: s.caption || '',
    transition_type: s.transition || 'fade',
    duration_seconds: s.duration || 3,
  }));

  const { error } = await supabase.from('screenshots').insert(rows);
  if (error) throw error;
}

/**
 * Get a project with its screenshots.
 */
export async function getProject(projectId: string) {
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (pErr) throw pErr;

  const { data: screenshots, error: sErr } = await supabase
    .from('screenshots')
    .select('*')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });

  if (sErr) throw sErr;

  return { project, screenshots };
}

/**
 * List all projects for the current user.
 */
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Update a project.
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId);
  if (error) throw error;
}
