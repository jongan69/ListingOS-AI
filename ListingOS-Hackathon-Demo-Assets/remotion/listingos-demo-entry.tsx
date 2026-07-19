import {
  AbsoluteFill,
  Audio,
  Composition,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {CSSProperties} from 'react';

const FPS = 30;
const DURATION_IN_FRAMES = 3977;

const colors = {
  ink: '#06111c',
  white: '#f6fbff',
  muted: '#a9bdcb',
  cyan: '#8fd4ff',
  mint: '#70e5d5',
};

const fadeIn = (frame: number, start: number, length = 18) =>
  interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const fadeOut = (frame: number, end: number, length = 18) =>
  interpolate(frame, [end - length, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const Beat = ({
  start,
  end,
  eyebrow,
  title,
  detail,
}: {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  detail: string;
}) => {
  const frame = useCurrentFrame();
  const progress = spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config: {damping: 180, stiffness: 120, mass: 0.8},
  });
  const opacity = fadeIn(frame, start) * fadeOut(frame, end);
  const translateY = interpolate(progress, [0, 1], [18, 0]);

  const panelStyle: CSSProperties = {
    position: 'absolute',
    left: 92,
    bottom: 76,
    width: 720,
    padding: '22px 28px 24px',
    borderRadius: 26,
    backgroundColor: 'rgba(4, 15, 25, 0.82)',
    border: `1px solid rgba(143, 212, 255, ${0.24 * opacity})`,
    boxShadow: '0 18px 50px rgba(0, 0, 0, 0.28)',
    opacity,
    transform: `translateY(${translateY}px)`,
  };

  return (
    <div style={panelStyle}>
      <div
        style={{
          color: colors.mint,
          fontFamily: 'Arial, sans-serif',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 2.8,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: colors.white,
          fontFamily: 'Arial, sans-serif',
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: -0.8,
          lineHeight: 1.08,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: colors.muted,
          fontFamily: 'Arial, sans-serif',
          fontSize: 20,
          lineHeight: 1.25,
          marginTop: 10,
        }}
      >
        {detail}
      </div>
    </div>
  );
};

const Chapter = ({
  start,
  end,
  label,
  index,
}: {
  start: number;
  end: number;
  label: string;
  index: string;
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, start, 12) * fadeOut(frame, end, 12);
  return (
    <div
      style={{
        position: 'absolute',
        left: 92,
        top: 68,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity,
      }}
    >
      <div
        style={{
          color: colors.ink,
          backgroundColor: colors.mint,
          borderRadius: 999,
          padding: '9px 13px 8px',
          fontFamily: 'Arial, sans-serif',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 1.5,
        }}
      >
        {index}
      </div>
      <div
        style={{
          color: colors.white,
          fontFamily: 'Arial, sans-serif',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2.5,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const ListingOSDemo = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const introOpacity = fadeIn(frame, 0, 24) * fadeOut(frame, 230, 24);
  const progress = interpolate(frame, [0, DURATION_IN_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: colors.ink}}>
      <OffthreadVideo
        src={staticFile('listingos-horizontal-demo-rotato-enhanced-20260718.mp4')}
        style={{width, height, objectFit: 'cover'}}
        muted
      />
      <AbsoluteFill style={{backgroundColor: 'rgba(2, 10, 18, 0.06)'}} />

      <Sequence from={0} durationInFrames={260}>
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 94,
            opacity: introOpacity,
          }}
        >
          <div
            style={{
              color: colors.white,
              fontFamily: 'Arial, sans-serif',
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -1,
              textShadow: '0 3px 18px rgba(0,0,0,0.48)',
            }}
          >
            Photo in. Listing out.
          </div>
          <div
            style={{
              color: colors.cyan,
              fontFamily: 'Arial, sans-serif',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3.4,
              marginTop: 12,
            }}
          >
            LISTINGOS / CAMERA-FIRST SELLER AI
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={260} durationInFrames={DURATION_IN_FRAMES - 260}>
        <Chapter start={0} end={430} label="CAPTURE" index="01" />
        <Chapter start={430} end={1500} label="BUILD" index="02" />
        <Chapter start={1500} end={2750} label="REVIEW" index="03" />
        <Chapter start={2750} end={DURATION_IN_FRAMES - 260} label="PUBLISH" index="04" />

        <Beat
          start={80}
          end={430}
          eyebrow="CAPTURE ONCE"
          title="Keep moving while the listing builds."
          detail="A few clear product photos become one intentional listing batch."
        />
        <Beat
          start={470}
          end={1120}
          eyebrow="ASYNC AI PIPELINE"
          title="The queue does the heavy lifting."
          detail="Cloudflare stores the photos, GPT builds the draft, and the seller can start the next item."
        />
        <Beat
          start={1180}
          end={2050}
          eyebrow="ONE REVIEW SURFACE"
          title="Strong defaults. Minimal typing."
          detail="Title, category, condition, specifics, pricing, confidence, and copy stay editable in one place."
        />
        <Beat
          start={2110}
          end={2920}
          eyebrow="EBAY-AWARE"
          title="Verify before anything goes live."
          detail="Required fields and publish blockers surface before the listing is sent to eBay."
        />
        <Beat
          start={2980}
          end={DURATION_IN_FRAMES - 280}
          eyebrow="REAL PUBLISH PROOF"
          title="A live listing, not a mockup."
          detail="The Android flow returns to the queue with a published eBay item and buyer-facing proof."
        />
      </Sequence>

      <div
        style={{
          position: 'absolute',
          left: 92,
          right: 92,
          bottom: 34,
          height: 3,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: colors.mint,
          }}
        />
      </div>

      <Audio src={staticFile('listingos-demo-narration-synthetic.wav')} volume={0.98} />
      <Audio src={staticFile('listingos-demo-music-bed.mp3')} volume={0.11} loop />
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="ListingOSDemo"
    component={ListingOSDemo}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={DURATION_IN_FRAMES}
  />
);

registerRoot(Root);
