export function renderToolsPageBody(isEn: boolean): string {
  return `
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:14px;margin-bottom:20px;">
      <div>
        <span class="badge">${isEn ? 'FREE FPS UTILITIES - ZERO LOGIN REQUIRED' : 'CÔNG CỤ FPS MIỄN PHÍ - KHÔNG CẦN ĐĂNG NHẬP'}</span>
        <h1>${isEn ? 'Sensitivity Converter, Crosshair Lab &amp; PUBG Lookup' : 'Quy đổi Độ nhạy Chuột, Xem trước Tâm ngắm &amp; Tra cứu PUBG'}</h1>
        <p style="max-width:64ch;margin:0;">
          ${
            isEn
              ? 'Convert exact 360-degree mouse distance across VALORANT, PUBG, and CS2, test crosshair presets live, or inspect recent public PUBG match stats.'
              : 'Quy đổi chính xác độ nhạy chuột giữa VALORANT, PUBG và CS2 theo khoảng cách xoay 360 độ (cm/360), tạo mã tâm ngắm và tra cứu nhanh hồ sơ PUBG.'
          }
        </p>
      </div>
      <a class="btn-primary" href="/download">
        ${isEn ? 'Save Presets in Desktop App (.exe)' : 'Lưu kho Sens trong App Desktop (.exe)'}
      </a>
    </div>

    <div class="tools-grid">
      <!-- 1. SENSITIVITY & EDPI CONVERTER -->
      <section class="card" aria-label="${isEn ? 'Sensitivity and eDPI Converter' : 'Bo quy doi do nhay va eDPI'}">
        <span class="feature-tag">${isEn ? 'TOOL 01 - TRUE CM/360 CONVERTER' : 'CÔNG CỤ 01 - QUY ĐỔI CM/360 CHUẨN'}</span>
        <h2 style="margin-top:4px;">${isEn ? 'VALORANT &harr; PUBG &harr; CS2 Sensitivity' : 'Quy đổi Sens VALORANT &harr; PUBG &harr; CS2'}</h2>

        <div class="form-grid-3">
          <div class="field">
            <label for="sens-from-game">${isEn ? 'Source Game' : 'Game gốc'}</label>
            <select id="sens-from-game">
              <option value="VALORANT">VALORANT</option>
              <option value="PUBG">PUBG (General 103 FOV)</option>
              <option value="CS2">CS2 / CS:GO</option>
            </select>
          </div>
          <div class="field">
            <label for="sens-input-val">${isEn ? 'In-Game Sensitivity' : 'Độ nhạy trong game'}</label>
            <input id="sens-input-val" type="number" step="0.001" min="0.01" max="100" value="0.35" />
          </div>
          <div class="field">
            <label for="sens-dpi-val">${isEn ? 'Mouse DPI' : 'DPI chuột'}</label>
            <input id="sens-dpi-val" type="number" step="50" min="100" max="16000" value="800" />
          </div>
        </div>

        <div class="result-grid" style="margin-top:16px;">
          <div class="result-box" style="border-top:2px solid #FF4655;">
            <span class="result-label">VALORANT</span>
            <strong id="out-valo" class="result-num" style="color:#FF4655;">0.350</strong>
            <span id="out-valo-edpi" class="result-sub">eDPI: 280</span>
          </div>
          <div class="result-box" style="border-top:2px solid #E59A23;">
            <span class="result-label">PUBG GENERAL</span>
            <strong id="out-pubg" class="result-num" style="color:#E59A23;">34.8</strong>
            <span id="out-pubg-ads" class="result-sub">ADS: 34.8 | 2x: 33.8</span>
          </div>
          <div class="result-box" style="border-top:2px solid #38BDF8;">
            <span class="result-label">CS2 / CS:GO</span>
            <strong id="out-cs2" class="result-num" style="color:#38BDF8;">1.114</strong>
            <span id="out-cs2-edpi" class="result-sub">eDPI: 891</span>
          </div>
        </div>

        <div class="cm360-bar">
          <div>
            <span class="mono" style="color:#94A3B8;">${isEn ? 'TRUE 360 TURN DISTANCE' : 'QUÃNG ĐƯỜNG XOAY 360 ĐỘ'}</span>
            <div style="font-size:18px;font-weight:800;color:#10B981;font-family:ui-monospace,monospace;">
              <span id="out-cm360">46.65 cm</span>
              <span style="font-size:12px;color:#94A3B8;font-weight:500;"> (<span id="out-in360">18.37 in</span>)</span>
            </div>
          </div>
          <span id="out-tier" class="pill-tier">${isEn ? 'Balanced Tactical Pro' : 'Cân bằng (Chuẩn Pro)'}</span>
        </div>
      </section>

      <!-- 2. LIVE CROSSHAIR PREVIEWER & CODE GENERATOR -->
      <section class="card" aria-label="${isEn ? 'Live Crosshair Generator' : 'Trinh tao tam ngam truc tiep'}">
        <span class="feature-tag">${isEn ? 'TOOL 02 - CROSSHAIR LAB' : 'CÔNG CỤ 02 - PHÒNG TÂM NGẮM'}</span>
        <h2 style="margin-top:4px;">${isEn ? 'Live Crosshair Preview &amp; VALORANT Code' : 'Xem trước Tâm ngắm &amp; Tạo mã VALORANT'}</h2>

        <div class="crosshair-stage">
          <canvas id="xhairCanvas" width="460" height="170" role="img" aria-label="${
            isEn ? 'Live crosshair preview canvas' : 'Khung xem truoc tam ngam'
          }"></canvas>
          <div class="bg-pills">
            <button type="button" class="mini-btn active" data-xbg="dark">${isEn ? 'Dark' : 'Tối'}</button>
            <button type="button" class="mini-btn" data-xbg="sand">${isEn ? 'Dust' : 'Cát'}</button>
            <button type="button" class="mini-btn" data-xbg="sky">${isEn ? 'Bright' : 'Sáng'}</button>
          </div>
        </div>

        <div class="sliders-grid">
          <div class="field">
            <label for="xh-len">${isEn ? 'Inner Length' : 'Độ dài vạch'}: <span id="lbl-len">4</span></label>
            <input id="xh-len" type="range" min="1" max="10" value="4" />
          </div>
          <div class="field">
            <label for="xh-thick">${isEn ? 'Thickness' : 'Độ dày'}: <span id="lbl-thick">2</span></label>
            <input id="xh-thick" type="range" min="1" max="6" value="2" />
          </div>
          <div class="field">
            <label for="xh-gap">${isEn ? 'Center Gap' : 'Khe hở giữa'}: <span id="lbl-gap">2</span></label>
            <input id="xh-gap" type="range" min="0" max="10" value="2" />
          </div>
          <div class="field">
            <label for="xh-color">${isEn ? 'Color' : 'Màu tâm'}</label>
            <select id="xh-color">
              <option value="1" data-hex="#10B981">${isEn ? 'Green' : 'Xanh lá'}</option>
              <option value="5" data-hex="#38BDF8" selected>${isEn ? 'Cyan' : 'Xanh dương'}</option>
              <option value="2" data-hex="#E59A23">${isEn ? 'Yellow / Amber' : 'Vàng'}</option>
              <option value="7" data-hex="#FF4655">${isEn ? 'Red' : 'Đỏ'}</option>
              <option value="0" data-hex="#FFFFFF">${isEn ? 'White' : 'Trắng'}</option>
            </select>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;cursor:pointer;">
            <input id="xh-dot" type="checkbox" />
            <span>${isEn ? 'Center Dot' : 'Chấm giữa'}</span>
          </label>
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;cursor:pointer;">
            <input id="xh-outline" type="checkbox" checked />
            <span>${isEn ? 'Black Outline' : 'Viền đen'}</span>
          </label>
        </div>

        <div class="code-copy-row">
          <label for="xh-code-out" class="sr-only">${isEn ? 'Generated VALORANT crosshair code' : 'Ma tam ngam VALORANT'}</label>
          <input id="xh-code-out" type="text" readonly value="0;P;c;5;o;1;0l;4;0t;2;0o;2;0a;1;0f;0;1b;0" />
          <button id="xh-copy-btn" type="button" class="btn-primary" style="padding:8px 14px;font-size:12px;">
            ${isEn ? 'Copy Code' : 'Sao chép'}
          </button>
        </div>
      </section>
    </div>

    <!-- 3. PUBLIC PUBG QUICK PLAYER LOOKUP -->
    <section class="card" style="margin-top:20px;" aria-label="${isEn ? 'Public PUBG player lookup' : 'Tra cuu nhanh nguoi choi PUBG'}">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #232B3B;padding-bottom:12px;margin-bottom:14px;">
        <div>
          <span class="feature-tag" style="color:#E59A23;">${isEn ? 'TOOL 03 - OFFICIAL PUBG SHARD LOOKUP' : 'CÔNG CỤ 03 - TRA CỨU NHANH HỒ SƠ PUBG'}</span>
          <h2 style="margin:2px 0 0;">${isEn ? 'Check Recent PUBG Matches Instantly' : 'Tra cứu nhanh các trận PUBG gần nhất'}</h2>
        </div>
        <span class="mono" style="color:#64748B;">${isEn ? 'VALORANT personal matches remain RSO-gated' : 'Lịch sử VALORANT luôn khóa bảo vệ qua RSO'}</span>
      </div>

      <form id="pubgLookupForm" style="display:flex;flex-wrap:wrap;gap:8px;">
        <label for="pubgLookupInput" class="sr-only">${isEn ? 'PUBG In-Game Name' : 'Ten nhan vat PUBG'}</label>
        <input id="pubgLookupInput" type="text" placeholder="${
          isEn ? 'Enter exact PUBG IGN (case-sensitive, e.g. TGLTN)...' : 'Nhập chính xác tên nhân vật PUBG (phân biệt hoa/thường)...'
        }" style="flex:1;min-width:220px;padding:10px 12px;border-radius:2px;background:#0A0D12;border:1px solid #232B3B;color:#EEF2F6;font-size:13px;" />
        <button id="pubgLookupBtn" type="submit" class="btn-primary" style="background:#E59A23;border-color:#E59A23;color:#0A0D12;">
          ${isEn ? 'Search PUBG Profile' : 'Tìm hồ sơ PUBG'}
        </button>
      </form>

      <div id="pubgLookupStatus" style="margin-top:10px;font-size:12px;color:#94A3B8;"></div>
      <div id="pubgLookupResults" class="lookup-grid"></div>
    </section>

    <script>
      (function() {
        var isEn = ${isEn ? 'true' : 'false'};

        // 1. Sensitivity Converter (True cm/360)
        var fromGameEl = document.getElementById('sens-from-game');
        var sensValEl = document.getElementById('sens-input-val');
        var dpiValEl = document.getElementById('sens-dpi-val');

        function pubgSliderToValo(slider) {
          var s = Math.max(1, Math.min(100, slider));
          var mult = Math.pow(10, (s - 50) / 50);
          // At PUBG slider 50 (mult=1.0), effective yaw ~0.0444 deg/count -> Valo equivalent ~0.634
          return (0.0444 * mult) / 0.07;
        }

        function valoToPubgSlider(valoSens) {
          var degPerCount = valoSens * 0.07;
          var mult = Math.max(0.05, degPerCount / 0.0444);
          var s = 50 + 50 * Math.log10(mult);
          return Math.max(1, Math.min(100, s));
        }

        function updateSens() {
          var src = fromGameEl.value;
          var rawSens = Math.max(0.005, parseFloat(sensValEl.value) || 0.35);
          var dpi = Math.max(100, Math.min(20000, parseFloat(dpiValEl.value) || 800));

          var valoSens = rawSens;
          if (src === 'CS2') {
            valoSens = rawSens * (0.022 / 0.07);
          } else if (src === 'PUBG') {
            valoSens = pubgSliderToValo(rawSens);
          }

          var cs2Sens = valoSens * (0.07 / 0.022);
          var pubgGen = valoToPubgSlider(valoSens);
          var pubgAds = Math.max(1, pubgGen - 1.2);
          var pubg2x = Math.max(1, pubgGen - 2.0);
          var valoEdpi = Math.round(valoSens * dpi);
          var cs2Edpi = Math.round(cs2Sens * dpi);
          var cm360 = (2.54 * 360) / (dpi * valoSens * 0.07);
          var in360 = cm360 / 2.54;

          document.getElementById('out-valo').textContent = valoSens.toFixed(3);
          document.getElementById('out-valo-edpi').textContent = 'eDPI: ' + valoEdpi;
          document.getElementById('out-pubg').textContent = pubgGen.toFixed(1);
          document.getElementById('out-pubg-ads').textContent = 'ADS: ' + pubgAds.toFixed(1) + ' | 2x: ' + pubg2x.toFixed(1);
          document.getElementById('out-cs2').textContent = cs2Sens.toFixed(3);
          document.getElementById('out-cs2-edpi').textContent = 'eDPI: ' + cs2Edpi;
          document.getElementById('out-cm360').textContent = cm360.toFixed(2) + ' cm';
          document.getElementById('out-in360').textContent = in360.toFixed(2) + ' in';

          var tier = isEn ? 'Balanced Tactical Pro' : 'Cân bằng (Chuẩn Pro)';
          if (cm360 > 58) tier = isEn ? 'Low Sens (Arm Aim Control)' : 'Thấp (Điều tâm bằng tay)';
          else if (cm360 < 28) tier = isEn ? 'High Sens (Fast Wrist Flick)' : 'Cao (Vẩy cổ tay nhanh)';
          document.getElementById('out-tier').textContent = tier;
        }

        fromGameEl.addEventListener('change', function() {
          if (fromGameEl.value === 'PUBG' && parseFloat(sensValEl.value) < 5) sensValEl.value = '35';
          else if (fromGameEl.value === 'VALORANT' && parseFloat(sensValEl.value) > 5) sensValEl.value = '0.35';
          else if (fromGameEl.value === 'CS2' && parseFloat(sensValEl.value) > 10) sensValEl.value = '1.10';
          updateSens();
        });
        sensValEl.addEventListener('input', updateSens);
        dpiValEl.addEventListener('input', updateSens);
        updateSens();

        // 2. Crosshair Canvas Previewer
        var xCanvas = document.getElementById('xhairCanvas');
        var xCtx = xCanvas.getContext('2d');
        var xBg = 'dark';
        var lenEl = document.getElementById('xh-len');
        var thickEl = document.getElementById('xh-thick');
        var gapEl = document.getElementById('xh-gap');
        var colorEl = document.getElementById('xh-color');
        var dotEl = document.getElementById('xh-dot');
        var outlineEl = document.getElementById('xh-outline');
        var codeOutEl = document.getElementById('xh-code-out');

        function drawCrosshair() {
          var len = Number(lenEl.value);
          var thick = Number(thickEl.value);
          var gap = Number(gapEl.value);
          var opt = colorEl.options[colorEl.selectedIndex];
          var hex = opt.getAttribute('data-hex') || '#38BDF8';
          var colorId = colorEl.value;
          var hasDot = dotEl.checked;
          var hasOutline = outlineEl.checked;

          document.getElementById('lbl-len').textContent = String(len);
          document.getElementById('lbl-thick').textContent = String(thick);
          document.getElementById('lbl-gap').textContent = String(gap);

          var w = xCanvas.width, h = xCanvas.height;
          if (xBg === 'sand') xCtx.fillStyle = '#8B795E';
          else if (xBg === 'sky') xCtx.fillStyle = '#CBD5E1';
          else xCtx.fillStyle = '#0B1017';
          xCtx.fillRect(0, 0, w, h);

          // Subtle target silhouette for head-level reference
          xCtx.fillStyle = xBg === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(10,13,18,0.12)';
          xCtx.beginPath();
          xCtx.arc(w / 2, h / 2, 24, 0, Math.PI * 2);
          xCtx.fill();
          xCtx.fillRect(w / 2 - 36, h / 2 + 26, 72, 60);

          var cx = Math.round(w / 2);
          var cy = Math.round(h / 2);
          var pxLen = len * 3;
          var pxThick = Math.max(1, thick);
          var pxGap = gap * 2 + 2;

          function drawRect(x, y, rw, rh) {
            if (hasOutline) {
              xCtx.fillStyle = '#000000';
              xCtx.fillRect(x - 1, y - 1, rw + 2, rh + 2);
            }
            xCtx.fillStyle = hex;
            xCtx.fillRect(x, y, rw, rh);
          }

          drawRect(cx - pxGap - pxLen, cy - Math.floor(pxThick / 2), pxLen, pxThick);
          drawRect(cx + pxGap, cy - Math.floor(pxThick / 2), pxLen, pxThick);
          drawRect(cx - Math.floor(pxThick / 2), cy - pxGap - pxLen, pxThick, pxLen);
          drawRect(cx - Math.floor(pxThick / 2), cy + pxGap, pxThick, pxLen);

          if (hasDot) {
            drawRect(cx - Math.floor(pxThick / 2), cy - Math.floor(pxThick / 2), pxThick, pxThick);
          }

          var code = '0;P;c;' + colorId + ';o;' + (hasOutline ? '1' : '0') + (hasDot ? ';d;1;z;' + pxThick : '') +
            ';0l;' + len + ';0t;' + thick + ';0o;' + gap + ';0a;1;0f;0;1b;0';
          codeOutEl.value = code;
        }

        [lenEl, thickEl, gapEl, colorEl, dotEl, outlineEl].forEach(function(el) {
          el.addEventListener('input', drawCrosshair);
          el.addEventListener('change', drawCrosshair);
        });
        document.querySelectorAll('[data-xbg]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            xBg = btn.getAttribute('data-xbg');
            document.querySelectorAll('[data-xbg]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            drawCrosshair();
          });
        });
        document.getElementById('xh-copy-btn').addEventListener('click', function() {
          var btn = this;
          navigator.clipboard.writeText(codeOutEl.value).then(function() {
            btn.textContent = isEn ? 'Copied!' : 'Đã chép!';
            setTimeout(function() { btn.textContent = isEn ? 'Copy Code' : 'Sao chép'; }, 1800);
          });
        });
        drawCrosshair();

        // 3. Public PUBG Lookup calling /api/analyze/player-search
        var lookupForm = document.getElementById('pubgLookupForm');
        var lookupInput = document.getElementById('pubgLookupInput');
        var lookupStatus = document.getElementById('pubgLookupStatus');
        var lookupResults = document.getElementById('pubgLookupResults');

        lookupForm.addEventListener('submit', function(e) {
          e.preventDefault();
          var q = (lookupInput.value || '').trim();
          if (!q) return;
          lookupStatus.textContent = isEn ? 'Querying PUBG Shard API...' : 'Đang tra cứu PUBG Shard API...';
          lookupResults.innerHTML = '';

          fetch('/api/analyze/player-search?gameType=PUBG&query=' + encodeURIComponent(q))
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(res) {
              if (!res.ok) {
                lookupStatus.textContent = res.data.error || (isEn ? 'Player not found.' : 'Không tìm thấy người chơi.');
                return;
              }
              var matches = res.data.recentMatches || [];
              lookupStatus.innerHTML = (isEn ? 'Found profile ' : 'Tìm thấy hồ sơ ') +
                '<strong style="color:#EEF2F6;">' + String(res.data.player.name).replace(/</g, '&lt;') + '</strong>' +
                ' (' + matches.length + (isEn ? ' recent matches)' : ' trận gần nhất)');

              lookupResults.innerHTML = matches.slice(0, 6).map(function(m) {
                var dt = m.playedAt ? new Date(m.playedAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN') : '';
                return '<div class="lookup-card">' +
                  '<div style="display:flex;justify-content:space-between;font-family:ui-monospace,monospace;font-size:11px;color:#94A3B8;">' +
                  '<strong style="color:#EEF2F6;">' + String(m.mapName || 'PUBG').replace(/</g, '&lt;') + '</strong>' +
                  '<span>' + dt + '</span></div>' +
                  '<div style="font-family:ui-monospace,monospace;font-size:14px;font-weight:700;color:#E59A23;margin-top:4px;">TOP #' + m.winPlace + ' - ' + m.kills + 'K</div>' +
                  '<div style="font-family:ui-monospace,monospace;font-size:11px;color:#64748B;">' + String(m.gameMode || '').replace(/</g, '&lt;') + ' - ' + m.damageDealt + ' DMG</div>' +
                  '</div>';
              }).join('');
            })
            .catch(function() {
              lookupStatus.textContent = isEn ? 'Network error while querying PUBG API.' : 'Lỗi kết nối khi tra cứu PUBG API.';
            });
        });
      })();
    </script>
  `;
}

export const toolsPageExtraStyles = `
  <style>
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .tools-grid {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 18px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .tools-grid { grid-template-columns: 1fr; }
    }
    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    @media (max-width: 560px) {
      .form-grid-3 { grid-template-columns: 1fr; }
    }
    .field label {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #94A3B8;
      margin-bottom: 5px;
    }
    .field input[type='number'],
    .field select {
      width: 100%;
      padding: 9px 10px;
      border-radius: 2px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      color: #EEF2F6;
      font-family: ui-monospace, monospace;
      font-size: 13px;
    }
    .field input[type='range'] {
      width: 100%;
      accent-color: #38BDF8;
    }
    .result-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    @media (max-width: 560px) {
      .result-grid { grid-template-columns: 1fr; }
    }
    .result-box {
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
      padding: 12px;
      text-align: center;
    }
    .result-label {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      color: #94A3B8;
      font-weight: 700;
    }
    .result-num {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 22px;
      margin: 4px 0;
    }
    .result-sub {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 10.5px;
      color: #64748B;
    }
    .cm360-bar {
      margin-top: 14px;
      padding: 12px 14px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .pill-tier {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 2px;
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38BDF8;
    }
    .crosshair-stage {
      position: relative;
      border: 1px solid #232B3B;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 10px;
    }
    .crosshair-stage canvas {
      display: block;
      width: 100%;
      height: auto;
    }
    .bg-pills {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
    }
    .mini-btn {
      padding: 3px 8px;
      border-radius: 2px;
      border: 1px solid #334155;
      background: rgba(10, 13, 18, 0.85);
      color: #94A3B8;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      cursor: pointer;
    }
    .mini-btn.active {
      border-color: #38BDF8;
      color: #38BDF8;
      font-weight: 700;
    }
    .sliders-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    .code-copy-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .code-copy-row input {
      flex: 1;
      min-width: 0;
      padding: 8px 10px;
      border-radius: 2px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      color: #38BDF8;
      font-family: ui-monospace, monospace;
      font-size: 12px;
    }
    .lookup-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    @media (max-width: 720px) {
      .lookup-grid { grid-template-columns: 1fr; }
    }
    .lookup-card {
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
      padding: 10px 12px;
    }
  </style>
`;
