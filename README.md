# Scribble Relay

A pass-the-device drawing party game for 3 to 12 players. Think Chinese whispers
with drawings.

**Play it:** https://juslangit.github.io/scribble-relay/

## How it plays

1. The first player secretly **writes** a phrase, like *"a cat robbing a bank"*.
2. The next player sees only that phrase and **draws** it before the timer runs out.
3. The next player sees only the drawing and **guesses** what it is.
4. It keeps alternating (draw, guess, draw, guess) until everyone has had a turn.
5. Everyone gathers round for the **reveal**: the whole chain plays back one step
   at a time, so you can see exactly where it went wrong. Crown the funniest turn,
   then save the whole chain as one image to share.

## Works on

Phones, tablets and computers, in portrait or landscape. Draw with a finger, a
stylus or a mouse. On a phone, the keyboard never covers the guess box, and the
screen stays awake during a game.

## Tech

One `index.html` file: HTML, CSS and JavaScript, with **no libraries and no
server**. The only thing it loads is two Google Fonts, and it still works without
them. Sound effects are generated in code, so there are no audio files.

Open `index.html` in a browser to play locally.

## Tests

```bash
./test/run.sh
```

Plays a full 4-player game in headless Chrome at phone, phone-landscape, tablet
and desktop sizes, drawing with real touch and mouse input. It checks turn order,
undo, the timer auto-submitting, the reveal, the saved chain image, and that no
screen scrolls sideways. Needs Node and Google Chrome.
