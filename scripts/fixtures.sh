#!/usr/bin/env sh
# Makes the demo film and its extras in examples/demo/public/media (needs ffmpeg with libx265
# and the Inter typeface, or set FONT to another .ttf/.otf). Everything here is generated, so
# the demo and the screenshots carry no third-party footage.
set -e
dir="$(cd "$(dirname "$0")/.." && pwd)/examples/demo/public/media"
mkdir -p "$dir"
cd "$dir"
FONT="${FONT:-$(fc-match -f '%{file}' 'Inter Display:bold' 2>/dev/null || true)}"
D=150

cat > chapters.txt <<'TXT'
;FFMETADATA1
title=Northern Lights
[CHAPTER]
TIMEBASE=1/1000
START=0
END=12000
title=Cold open
[CHAPTER]
TIMEBASE=1/1000
START=12000
END=40000
title=Opening
[CHAPTER]
TIMEBASE=1/1000
START=40000
END=85000
title=The Valley
[CHAPTER]
TIMEBASE=1/1000
START=85000
END=128000
title=The Ridge
[CHAPTER]
TIMEBASE=1/1000
START=128000
END=150000
title=Ending
TXT

cat > en.srt <<'TXT'
1
00:00:01,000 --> 00:00:05,500
The sky over the fjord was quiet tonight.

2
00:00:06,000 --> 00:00:11,000
Then, all at once, it began to move.

3
00:00:41,000 --> 00:00:47,000
We followed the light down into the valley.

4
00:00:48,000 --> 00:00:54,000
Nobody spoke. Nobody needed to.

5
00:01:26,000 --> 00:01:32,000
From the ridge you could see the whole coast.

6
00:01:33,000 --> 00:01:40,000
Green, then violet, then a colour with no name.

7
00:02:00,000 --> 00:02:07,000
By dawn it was gone, as if it had never been.
TXT

cat > es.srt <<'TXT'
1
00:00:01,000 --> 00:00:05,500
El cielo sobre el fiordo estaba tranquilo esta noche.

2
00:00:06,000 --> 00:00:11,000
Entonces, de repente, empezó a moverse.

3
00:00:41,000 --> 00:00:47,000
Seguimos la luz hasta el valle.

4
00:01:26,000 --> 00:01:32,000
Desde la cresta se veía toda la costa.

5
00:02:00,000 --> 00:02:07,000
Al amanecer ya no estaba.
TXT

cat > fr.vtt <<'TXT'
WEBVTT

00:00:01.000 --> 00:00:05.500
Le ciel au-dessus du fjord était calme ce soir.

00:00:06.000 --> 00:00:11.000
Puis, tout à coup, il s'est mis à bouger.

00:00:41.000 --> 00:00:47.000
Nous avons suivi la lumière jusque dans la vallée.

00:01:26.000 --> 00:01:32.000
Depuis la crête, on voyait toute la côte.

00:02:00.000 --> 00:02:07.000
À l'aube, elle avait disparu.
TXT

PICTURE="[0][1]blend=all_mode=screen:all_opacity=0.6,noise=alls=6:allf=t,vignette=PI/4"
TITLE="drawtext=fontfile=$FONT:text='NORTHERN LIGHTS':fontsize=64:fontcolor=white@0.85:x=(w-tw)/2:y=h*0.36:enable='between(t,14,38)'"
SKY="gradients=s=1280x720:r=24:n=5:c0=0x07142b:c1=0x0f5257:c2=0x37b385:c3=0x5b2a86:c4=0x050a1a:speed=0.012:type=linear:seed=7:d=$D"
GLOW="gradients=s=1280x720:r=24:n=3:c0=0x00000000:c1=0x9be8c855:c2=0x00000000:speed=0.02:type=radial:seed=3:d=$D"
CHORD="aevalsrc='(0.18*sin(2*PI*220*t)+0.12*sin(2*PI*277.18*t)+0.1*sin(2*PI*329.63*t))*(0.75+0.25*sin(2*PI*0.1*t))':s=48000:d=$D"
LOW="aevalsrc='(0.2*sin(2*PI*164.81*t)+0.12*sin(2*PI*246.94*t))*(0.75+0.25*sin(2*PI*0.07*t))':s=48000:d=$D"

ffmpeg -loglevel error -y -f lavfi -i "$SKY" -f lavfi -i "$GLOW" -f lavfi -i "$CHORD" -f lavfi -i "$LOW" \
  -i en.srt -i es.srt -i chapters.txt \
  -filter_complex "$PICTURE,$TITLE[v]" \
  -map '[v]' -map 2:a -map 3:a -map 4 -map 5 -map_metadata 6 -map_chapters 6 \
  -c:v libx265 -preset fast -x265-params log-level=error -crf 26 -pix_fmt yuv420p \
  -c:a:0 ac3 -b:a:0 192k -c:a:1 aac -b:a:1 128k -ac 2 -c:s srt \
  -metadata:s:a:0 language=eng -metadata:s:a:0 title="English" \
  -metadata:s:a:1 language=spa -metadata:s:a:1 title="Español" \
  -metadata:s:s:0 language=eng -metadata:s:s:0 title="English" \
  -metadata:s:s:1 language=spa -metadata:s:s:1 title="Español" \
  -t $D northern-lights.mkv

# The same film as H.264 + AAC MP4, which the browser's own decoder can play too.
ffmpeg -loglevel error -y -i northern-lights.mkv -map 0:v -map 0:a:1 -c:v libx264 -preset veryfast \
  -crf 24 -pix_fmt yuv420p -c:a copy -movflags +faststart northern-lights.mp4

# A backdrop (a frame of the film) and a poster for the pre-roll.
ffmpeg -loglevel error -y -ss 70 -i northern-lights.mkv -frames:v 1 -q:v 3 backdrop.jpg
ffmpeg -loglevel error -y -f lavfi -i "gradients=s=600x900:n=4:c0=0x07142b:c1=0x37b385:c2=0x5b2a86:c3=0x050a1a:type=radial:seed=11:d=1" \
  -vf "noise=alls=5,vignette=PI/4,drawtext=fontfile=$FONT:text='NORTHERN':fontsize=74:fontcolor=white:x=(w-tw)/2:y=h*0.62,drawtext=fontfile=$FONT:text='LIGHTS':fontsize=74:fontcolor=white:x=(w-tw)/2:y=h*0.62+86" \
  -frames:v 1 -q:v 3 poster.jpg
rm chapters.txt
echo "Demo media written to $dir"
