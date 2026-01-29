const https = require('https');
const fs = require('fs');

const API_KEY = process.env.YOUTUBE_API_KEY;

// Search queries in different languages
const searchQueries = [
  'day in the life worker',
  'a day in my life job',
  'día en la vida trabajo',
  'un día en mi vida trabajo',
  'día de trabajo en mi vida',
  'mi trabajo diario',
  'journée dans la vie travail',
  'une journée de travail',
  'journée de travail en Afrique',
  'mon travail quotidien',
  'Tag im Leben Arbeit',
  '仕事の一日',
  '工作中的一天',
  '我的工作日常',
  '职业日常',
  'dia na vida trabalho',
  'rotina de trabalho',
  'день из жизни работа',
  'мой рабочий день',
  'giorno nella vita lavoro',
  '직장인 하루',
  '일상 브이로그 직장',
  'يوم في الحياة عمل',
  'dag in het leven werk',
  'dzień w życiu praca',
  'how I dey work',
  'my work for Nigeria',
  'วันทำงานของฉัน',
  'एक दिन मेरी नौकरी',
  'mijn dagelijks werk',
  'τη δουλειά μου',
  'işimde bir gün',
  'pekerjaan sehari-hari',
  'việc làm hàng ngày'
];

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function searchYouTube(query, maxResults = 10) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${API_KEY}`;
  
  try {
    const data = await httpsGet(url);
    return data.items || [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

async function fetchNewVideos() {
  console.log('Fetching new videos from YouTube API...');
  const weekNumber = getWeekNumber(new Date());
  
  // Select 4 random queries based on week number
  const seed = weekNumber * 1000;
  const shuffledQueries = [...searchQueries].sort(() => seededRandom(seed + Math.random() * 100) - 0.5);
  const selectedQueries = shuffledQueries.slice(0, 4);
  
  console.log('Selected queries:', selectedQueries);
  
  // Fetch videos from selected queries
  const allVideos = [];
  for (const query of selectedQueries) {
    console.log(`Searching for: ${query}`);
    const videos = await searchYouTube(query, 10);
    allVideos.push(...videos);
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Remove duplicates and shuffle
  const uniqueVideos = Array.from(new Map(allVideos.map(v => [v.id.videoId, v])).values());
  const shuffledVideos = uniqueVideos.sort(() => seededRandom(seed + 500) - 0.5);
  
  // Select 12 videos
  const selectedVideos = shuffledVideos.slice(0, 12);
  
  return selectedVideos.map(v => ({
    videoId: v.id.videoId,
    title: v.snippet.title.replace(/"/g, '\\"').replace(/'/g, "\\'") // Escape quotes
  }));
}

async function updateIndexFile(videos) {
  const indexPath = 'index.html';
  let content = fs.readFileSync(indexPath, 'utf8');
  
  const weekNumber = getWeekNumber(new Date());
  
  console.log('Original CACHED_VIDEOS found in file');
  
  // Create the new CACHED_VIDEOS array - properly formatted for JavaScript
  const videosArray = videos.map(v => 
    `  {\n    "videoId": "${v.videoId}",\n    "title": "${v.title}"\n  }`
  ).join(',\n');
  
  const newCacheBlock = `const CACHED_VIDEOS = [\n${videosArray}\n];`;
  
  console.log('New cache block created:');
  console.log(newCacheBlock.substring(0, 200) + '...');
  
  // More flexible regex - matches any content between const CACHED_VIDEOS = [ and ];
  const cacheRegex = /const CACHED_VIDEOS\s*=\s*\[[^\]]*\];/s;
  
  if (cacheRegex.test(content)) {
    console.log('✅ Found CACHED_VIDEOS array, replacing...');
    content = content.replace(cacheRegex, newCacheBlock);
  } else {
    console.error('❌ Could not find CACHED_VIDEOS array in index.html');
    console.log('Searching for alternative pattern...');
    
    // Try alternative pattern
    const altRegex = /const CACHED_VIDEOS = \[\];/;
    if (altRegex.test(content)) {
      console.log('✅ Found empty CACHED_VIDEOS, replacing...');
      content = content.replace(altRegex, newCacheBlock);
    } else {
      console.error('❌ No CACHED_VIDEOS pattern found at all!');
      process.exit(1);
    }
  }
  
  // Update the week number comment
  const weekCommentRegex = /\/\/ Last updated: Week \d+/;
  if (weekCommentRegex.test(content)) {
    content = content.replace(weekCommentRegex, `// Last updated: Week ${weekNumber}`);
  }
  
  fs.writeFileSync(indexPath, content, 'utf8');
  console.log('✅ index.html updated successfully!');
  console.log(`📝 Updated with ${videos.length} videos for week ${weekNumber}`);
}

async function main() {
  if (!API_KEY) {
    console.error('❌ YOUTUBE_API_KEY environment variable is not set');
    process.exit(1);
  }
  
  try {
    const videos = await fetchNewVideos();
    console.log(`✅ Fetched ${videos.length} videos`);
    
    await updateIndexFile(videos);
    console.log('🎬 Videos updated for week', getWeekNumber(new Date()));
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
