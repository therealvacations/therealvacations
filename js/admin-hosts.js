import { supabase } from './supabase-client.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadHosts() {
  const box = $('#hostAdminList');
  if (!box) return;

  const [appsResult, membersResult, proposalsResult] = await Promise.all([
    supabase.from('host_applications').select('*').order('submitted_at', { ascending:false }),
    supabase.from('host_memberships').select('*'),
    supabase.from('host_trip_proposals').select('*').order('created_at', { ascending:false })
  ]);

  if (appsResult.error) {
    box.innerHTML = '<p>' + esc(appsResult.error.message) + '</p>';
    return;
  }

  const apps = appsResult.data || [];
  const members = membersResult.data || [];
  const proposals = proposalsResult.data || [];

  box.innerHTML = apps.map((a) => {
    const membership = members.find((m) => m.user_id === a.user_id);
    const ownProposals = proposals.filter((p) => p.user_id === a.user_id);
    return '<div class="admin-record">' +
      '<div class="record-heading"><div><h3>' + esc(a.display_name) + '</h3><p>' +
      esc(a.city || '') + ' · ' + esc(a.prior_platform || 'New TRV host') +
      '</p></div><span class="status-badge ' + (a.status === 'approved' ? 'active' : 'draft') + '">' +
      esc(a.status) + '</span></div>' +
      '<p class="record-summary">' + esc(a.bio || '') +
      '<br>Membership: ' + esc(membership?.status || 'not active') +
      ' · Proposals: ' + ownProposals.length + '</p>' +
      '<div class="record-actions">' +
      (a.status !== 'approved' ? '<button class="primary-button host-action" data-id="' + a.application_id + '" data-status="approved">Approve</button>' : '') +
      (a.status !== 'declined' ? '<button class="danger-button host-action" data-id="' + a.application_id + '" data-status="declined">Decline</button>' : '') +
      '</div></div>';
  }).join('') || '<div class="empty-state">No Host applications yet.</div>';

  document.querySelectorAll('.host-action').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { error } = await supabase.from('host_applications')
        .update({ status:button.dataset.status, reviewed_at:new Date().toISOString() })
        .eq('application_id', button.dataset.id);
      if (error) alert(error.message);
      await loadHosts();
    });
  });
}

document.querySelectorAll('.admin-tab').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.tab === 'hosts') loadHosts();
  });
});

if (new URLSearchParams(location.search).get('tab') === 'hosts') loadHosts();
