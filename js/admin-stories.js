import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',3500);};

let stories=[],gallery=[];

function resetStory(){ $('#storyForm')?.reset(); if($('#storyId'))$('#storyId').value=''; if($('#storyRating'))$('#storyRating').value='5'; if($('#storyFormTitle'))$('#storyFormTitle').textContent='Add Traveler Review'; }
async function loadStories(){
  if(!$('#storyList'))return;
  const {data,error}=await supabase.from('testimonials').select('*').order('created_at',{ascending:false});
  if(error)return toast(error.message,true);
  stories=data||[];
  $('#storyList').innerHTML=stories.map(s=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(s.author_name||'Traveler')+'</h3><p>'+esc([s.trip_location,s.trip_date].filter(Boolean).join(' · '))+'</p></div><span class="status-badge active">'+Number(s.rating||5)+'★</span></div><p class="record-summary">'+esc(s.review_text||'')+'</p><div class="record-actions"><button class="secondary-button edit-story" data-id="'+s.id+'" type="button">Edit</button><button class="danger-button delete-story" data-id="'+s.id+'" type="button">Delete</button></div></div>').join('')||'<div class="empty-state">No reviews yet.</div>';
  document.querySelectorAll('.edit-story').forEach(b=>b.onclick=()=>editStory(b.dataset.id));
  document.querySelectorAll('.delete-story').forEach(b=>b.onclick=()=>deleteStory(b.dataset.id));
}
function editStory(id){
  const s=stories.find(x=>String(x.id)===String(id));if(!s)return;
  $('#storyFormTitle').textContent='Edit Traveler Review';$('#storyId').value=s.id;$('#storyAuthor').value=s.author_name||'';$('#storyInitials').value=s.author_initials||'';$('#storyLocation').value=s.trip_location||'';$('#storyDate').value=s.trip_date||'';$('#storyRating').value=String(s.rating||5);$('#storyText').value=s.review_text||'';$('#storyForm').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteStory(id){if(!confirm('Delete this traveler review?'))return;const {error}=await supabase.from('testimonials').delete().eq('id',id);if(error)return toast(error.message,true);toast('Review deleted.');await loadStories();}
$('#storyForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#storyId').value;const payload={author_name:$('#storyAuthor').value.trim(),author_initials:$('#storyInitials').value.trim()||null,trip_location:$('#storyLocation').value.trim()||null,trip_date:$('#storyDate').value.trim()||null,review_text:$('#storyText').value.trim(),rating:Number($('#storyRating').value)||5,updated_at:new Date().toISOString()};
  if(!payload.author_name||!payload.review_text)return toast('Traveler name and review are required.',true);
  const q=id?supabase.from('testimonials').update(payload).eq('id',id):supabase.from('testimonials').insert(payload);
  const {error}=await q;if(error)return toast(error.message,true);toast(id?'Review updated.':'Review added.');resetStory();await loadStories();
});
$('#storyReset')?.addEventListener('click',resetStory);

function resetGallery(){ $('#galleryForm')?.reset(); if($('#galleryId'))$('#galleryId').value=''; if($('#galleryActive'))$('#galleryActive').checked=true; if($('#gallerySort'))$('#gallerySort').value='0'; if($('#galleryFormTitle'))$('#galleryFormTitle').textContent='Add Gallery Photo';}
async function loadGallery(){
 if(!$('#galleryList'))return;
 const {data,error}=await supabase.from('gallery_items').select('*').order('sort_order').order('id');
 if(error)return toast(error.message,true);
 gallery=data||[];
 $('#galleryList').innerHTML=gallery.map(g=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(g.caption||'Gallery photo')+'</h3><p>Order '+Number(g.sort_order||0)+'</p></div><span class="status-badge '+(g.is_active?'active':'archived')+'">'+(g.is_active?'Visible':'Hidden')+'</span></div><div style="margin:12px 0"><img src="'+esc(g.image_url)+'" alt="" style="width:140px;height:100px;object-fit:cover;border-radius:10px"></div><p class="record-summary">'+esc(g.alt_text||'')+'</p><div class="record-actions"><button class="secondary-button edit-gallery" data-id="'+g.id+'" type="button">Edit</button><button class="danger-button delete-gallery" data-id="'+g.id+'" type="button">Delete</button></div></div>').join('')||'<div class="empty-state">No gallery photos yet.</div>';
 document.querySelectorAll('.edit-gallery').forEach(b=>b.onclick=()=>editGallery(b.dataset.id));
 document.querySelectorAll('.delete-gallery').forEach(b=>b.onclick=()=>deleteGallery(b.dataset.id));
}
function editGallery(id){const g=gallery.find(x=>String(x.id)===String(id));if(!g)return;$('#galleryFormTitle').textContent='Edit Gallery Photo';$('#galleryId').value=g.id;$('#galleryImage').value=g.image_url||'';$('#galleryAlt').value=g.alt_text||'';$('#galleryCaption').value=g.caption||'';$('#gallerySort').value=g.sort_order||0;$('#galleryActive').checked=!!g.is_active;$('#galleryForm').scrollIntoView({behavior:'smooth',block:'start'});}
async function deleteGallery(id){if(!confirm('Delete this gallery photo?'))return;const {error}=await supabase.from('gallery_items').delete().eq('id',id);if(error)return toast(error.message,true);toast('Gallery photo deleted.');await loadGallery();}
$('#galleryForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const id=$('#galleryId').value;const payload={image_url:$('#galleryImage').value.trim(),alt_text:$('#galleryAlt').value.trim()||null,caption:$('#galleryCaption').value.trim()||null,sort_order:Number($('#gallerySort').value)||0,is_active:$('#galleryActive').checked,updated_at:new Date().toISOString()};
 if(!payload.image_url)return toast('Image URL is required.',true);
 const q=id?supabase.from('gallery_items').update(payload).eq('id',id):supabase.from('gallery_items').insert(payload);
 const {error}=await q;if(error)return toast(error.message,true);toast(id?'Gallery photo updated.':'Gallery photo added.');resetGallery();await loadGallery();
});
$('#galleryReset')?.addEventListener('click',resetGallery);
$('#galleryUpload')?.addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>10*1024*1024)return toast('Choose an image under 10 MB.',true);
 const ext=file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path='stories/'+Date.now()+'-'+crypto.randomUUID()+'.'+ext;
 const {error}=await supabase.storage.from('content-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
 if(error)return toast(error.message,true);const {data}=supabase.storage.from('content-media').getPublicUrl(path);$('#galleryImage').value=data.publicUrl;toast('Photo uploaded. Save it to publish.');
});

document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{
 if(btn.dataset.tab==='stories')loadStories();
 if(btn.dataset.tab==='gallery')loadGallery();
}));
