const VISION_MODULE = new URL("./vendor/mediapipe/vision_bundle.mjs", import.meta.url);
const WASM_ROOT = new URL("./vendor/mediapipe/wasm", import.meta.url);
const POSE_MODEL = new URL("./vendor/pose_landmarker_lite.task", import.meta.url);

const WRIST_INDEX = { left: 15, right: 16 };
const CALIBRATION_MS = 650;
const LOSS_MS = 350;
const FRAME_INTERVAL_MS = 45;
const SMOOTHING = 0.42;

function visible(point) {
  return point &&
    point.x >= 0 && point.x <= 1 &&
    point.y >= 0 && point.y <= 1 &&
    (point.visibility ?? 1) >= 0.5;
}

function wristOffset(landmarks, hand, aspectRatio) {
  const leftShoulder = landmarks?.[11];
  const rightShoulder = landmarks?.[12];
  const wrist = landmarks?.[WRIST_INDEX[hand]];
  if (![leftShoulder, rightShoulder, wrist].every(visible)) return null;

  const shoulderSpan = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    (leftShoulder.y - rightShoulder.y) / aspectRatio,
  );
  if (shoulderSpan < 0.055) return null;

  const centerX = (leftShoulder.x + rightShoulder.x) / 2;
  const centerY = (leftShoulder.y + rightShoulder.y) / 2;
  return {
    x: (centerX - wrist.x) / shoulderSpan,
    y: (wrist.y - centerY) / (shoulderSpan * aspectRatio),
  };
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function cameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "摄像头权限未开启。你可以使用鼠标或键盘继续。";
    case "NotFoundError":
      return "未找到摄像头。你可以使用鼠标或键盘继续。";
    case "NotReadableError":
    case "AbortError":
      return "摄像头暂时不可用。请检查是否被其他应用占用，或使用鼠标继续。";
    default:
      return "摄像头启动失败。你可以使用鼠标或键盘继续。";
  }
}

function release(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function createVisionInput(video, { onPoint, onStatus }) {
  let current = null;
  let hand = "right";
  let modelPromise = null;
  let lastStatus = null;

  function publish(state, message) {
    if (lastStatus?.state === state && lastStatus.message === message) return;
    lastStatus = { state, message };
    onStatus(lastStatus);
  }

  function endSession() {
    const session = current;
    current = null;
    if (!session) return;
    session.cancel(false);
    cancelAnimationFrame(session.frame);
    window.removeEventListener("pagehide", stop);
    document.removeEventListener("visibilitychange", suspendPoint);
    release(session.stream);
    if (session.stream && video.srcObject === session.stream) {
      video.pause();
      video.srcObject = null;
    }
    onPoint(null);
  }

  function stop() {
    endSession();
    publish("stopped", "摄像头已关闭。");
  }

  function fail(session, message) {
    if (current !== session) return;
    endSession();
    publish("error", message);
  }

  function loadModel() {
    if (!modelPromise) {
      modelPromise = (async () => {
        const { FilesetResolver, PoseLandmarker } = await import(VISION_MODULE.href);
        const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT.href);
        return PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL.href, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      })().catch((error) => {
        modelPromise = null;
        throw error;
      });
    }
    return modelPromise;
  }

  function promptCalibration() {
    const label = hand === "left" ? "左手" : "右手";
    publish("calibrating", `请让双肩入镜，把${label}放在胸前，在舒服的位置停一秒。`);
  }

  function recenter() {
    if (!current?.model) return;
    current.origin = null;
    current.candidate = null;
    current.filtered = null;
    current.lastVisibleAt = performance.now();
    onPoint(null);
    promptCalibration();
  }

  function setHand(nextHand) {
    if (!Object.hasOwn(WRIST_INDEX, nextHand) || nextHand === hand) return;
    hand = nextHand;
    recenter();
  }

  function losePoint(session, time) {
    session.candidate = null;
    if (session.filtered) {
      session.filtered = null;
      onPoint(null);
    }
    if (time - session.lastVisibleAt >= LOSS_MS) {
      const label = hand === "left" ? "左手" : "右手";
      publish("lost", `暂时没看到${label}。请面向摄像头，让双肩和手腕入镜。`);
    }
  }

  function suspendPoint() {
    if (document.hidden && current?.model) losePoint(current, performance.now());
  }

  function updatePoint(session, offset, time) {
    session.lastVisibleAt = time;
    if (!session.origin) {
      promptCalibration();
      const candidate = session.candidate;
      if (!candidate || Math.hypot(offset.x - candidate.x, offset.y - candidate.y) > 0.16) {
        session.candidate = { ...offset, since: time, samples: 1 };
        return;
      }
      candidate.samples += 1;
      candidate.x += (offset.x - candidate.x) / candidate.samples;
      candidate.y += (offset.y - candidate.y) / candidate.samples;
      if (time - candidate.since < CALIBRATION_MS || candidate.samples < 6) return;
      session.origin = { x: candidate.x, y: candidate.y };
      session.candidate = null;
    }

    const target = {
      x: clampUnit(0.5 + (offset.x - session.origin.x) / 1.45),
      y: clampUnit(0.5 + (offset.y - session.origin.y) / 1.2),
    };
    const previous = session.filtered;
    session.filtered = previous ? {
      x: previous.x + (target.x - previous.x) * SMOOTHING,
      y: previous.y + (target.y - previous.y) * SMOOTHING,
    } : target;
    publish("tracking", "体感已就绪。移动手腕指向目标。");
    onPoint(session.filtered);
  }

  function tick(session, time) {
    if (current !== session) return;
    if (video.readyState >= 2 && video.currentTime !== session.videoTime &&
        time - session.lastFrameAt >= FRAME_INTERVAL_MS) {
      session.videoTime = video.currentTime;
      session.lastFrameAt = time;
      let result;
      try {
        result = session.model.detectForVideo(video, time);
      } catch {
        modelPromise = null;
        fail(session, "体感识别中断。你可以重开摄像头，或使用鼠标继续。");
        session.model.close();
        return;
      }
      const offset = wristOffset(result.landmarks[0], hand, video.videoWidth / video.videoHeight);
      if (offset) updatePoint(session, offset, time);
      else losePoint(session, time);
    } else if (time - session.lastFrameAt >= LOSS_MS) {
      losePoint(session, time);
    }
    if (current === session) session.frame = requestAnimationFrame((nextTime) => tick(session, nextTime));
  }

  async function activate(session) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
      });
      if (current !== session) {
        release(stream);
        return false;
      }
      session.stream = stream;
      for (const track of stream.getVideoTracks()) {
        track.addEventListener("ended", () => {
          fail(session, "摄像头连接已断开。你可以使用鼠标或键盘继续。");
        }, { once: true });
      }
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      fail(session, cameraError(error));
      return false;
    }

    if (current !== session) return false;
    publish("loading", "正在加载本地姿态模型…");
    try {
      session.model = await loadModel();
    } catch {
      fail(session, "本地姿态模型加载失败。你可以使用鼠标或键盘继续。");
      return false;
    }
    if (current !== session) return false;

    recenter();
    session.frame = requestAnimationFrame((time) => tick(session, time));
    return true;
  }

  async function start({ hand: nextHand = hand } = {}) {
    endSession();
    if (!navigator.mediaDevices?.getUserMedia) {
      publish("error", "此页面无法开启摄像头。请用本机服务打开，或使用鼠标继续。");
      return false;
    }
    setHand(nextHand);
    const session = { frame: 0, videoTime: -1, lastFrameAt: -Infinity };
    const cancelled = new Promise((resolve) => { session.cancel = resolve; });
    current = session;
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", suspendPoint);
    publish("loading", "请允许使用摄像头。");
    return Promise.race([activate(session), cancelled]);
  }

  return { start, stop, setHand, recenter };
}
