/* Source-reviewed Fall 2026 reference. Does not change saved game rulesets. */
window.UmpireTrainingData = {
  "reviewed": "2026-09-13",
  "sources": {
    "rules": "https://drive.google.com/file/d/1H7kk-rCtM3zOudMHPHVBh6_gpIInT8CW/view",
    "slides": "https://docs.google.com/presentation/d/1P3oB_tEMecpWsMgnCP5163nIbIHfKymE/edit",
    "overthrows": "https://drive.google.com/file/d/1z-HMLh8lHgGX85vOBAPN7MoKxLdBlbwn/view",
    "signals": "https://drive.google.com/file/d/1L9KTT58ZPBS0crAA8qpNakbf33KbwneX/view"
  },
  "cards": [
    {
      "id": "strike",
      "topic": "Pitch & count",
      "title": "Is that pitch a strike?",
      "call": "STRIKE — if the pitch qualifies",
      "rule": "1.6, 8.2, 9.2",
      "action": "An un-kicked pitch must roll or touch the ground twice before home plate, meet the height requirements throughout the kicking box, and overlap the strike zone. A missed attempted kick is a strike inside or outside the zone.",
      "example": "A rolling pitch clips the outer edge of the zone: strike. An untouched pitch with only one bounce before the plate: ball.",
      "note": "The zone extends 1 foot to each side of home plate and 1 foot high; check the bottom of the ball against the height restrictions.",
      "visual": "pitch-enters-strike-zone",
      "keywords": "pitch bounce high swing miss zone"
    },
    {
      "id": "counts",
      "topic": "Pitch & count",
      "title": "Strikes and fouls are separate",
      "call": "3 STRIKES / 4 FOULS = OUT",
      "rule": "8.1, 9.1, 10.1, 11.1",
      "action": "Track balls, strikes and fouls independently: four balls normally awards first; three strikes or four fouls makes an out. Three outs ends the half inning.",
      "example": "With two strikes and three fouls, another foul is the fourth foul and an out. It does not become a third strike.",
      "note": "",
      "visual": null,
      "keywords": "count strikeout walk fourth foul"
    },
    {
      "id": "walk",
      "topic": "Pitch & count",
      "title": "When is a walk two bases?",
      "call": "SECOND — only for an intentional walk",
      "rule": "9.1–9.1.1",
      "action": "Award second only for four consecutive balls at the start of the count (4–0–0) AND clear avoidance of the strike zone. Advance other runners only as forced. Otherwise four balls awards first.",
      "example": "Four opening pitches clearly thrown to avoid the zone: kicker goes to second. Four balls with an earlier strike: ordinary walk.",
      "note": "",
      "visual": null,
      "keywords": "intentional walk four balls double"
    },
    {
      "id": "oob",
      "topic": "Overthrows",
      "title": "Throw leaves the designated game area",
      "call": "DEAD BALL · DESTINATION + 1",
      "rule": "7.11.1",
      "action": "Stop play when the overthrow crosses the agreed out-of-bounds boundary. Award each runner the base occupied or headed toward at that moment, plus one additional base.",
      "example": "Runner leaves first toward second when the ball goes out of bounds: award third.",
      "note": "Review the field binder boundaries with captains before the game. Off-turf alone is not the complete test.",
      "visual": "overthrow-left-game-area",
      "keywords": "overthrow fence road walkway out of bounds"
    },
    {
      "id": "unsafe",
      "topic": "Overthrows",
      "title": "Throw enters bags, goals or unsafe equipment",
      "call": "DEAD BALL · DESTINATION ONLY",
      "rule": "7.11.2–7.11.2.1",
      "action": "Stop play when the ball is within an unsafe or unplayable area. Award only the base each runner occupied or headed toward.",
      "example": "Runner is moving first to second when the ball becomes trapped in bags: award second, no extra base.",
      "note": "A ball merely leaning against equipment and easily/safely accessible is not automatically dead. People are handled under interference rules.",
      "visual": "overthrow-unsafe-area",
      "keywords": "dead ball bags equipment stuck unsafe overthrow"
    },
    {
      "id": "general",
      "topic": "Overthrows",
      "title": "Playable overthrow toward first",
      "call": "LIVE · KICKER LIMITED TO SECOND",
      "rule": "7.11.3–7.11.3.2",
      "action": "On fields 5 and 6, a general overthrow is playable, within the game area and more than 15 feet beyond the foul line. Toward first, the kicker may advance only to second, at risk; other runners may keep going.",
      "example": "Kicker reaches first and runs toward second after a general overthrow: the defense can still tag them out.",
      "note": "If a fielder brings the ball back into play and continues defensive play instead of ending it at the pitcher, the kicker may advance beyond second at risk.",
      "visual": "overthrow-past-first",
      "keywords": "overthrow live 15 feet field 5 field 6 second base"
    },
    {
      "id": "adjacent",
      "topic": "Overthrows",
      "title": "Ball enters another field or the shot-put area",
      "call": "ADJACENT INFIELD · DESTINATION + 2",
      "rule": "12.4.1–12.4.3",
      "action": "An adjacent infield ends the play: award the destination base plus two more. This applies even if that field has no game. The flagged shot-put area on field 6 is treated the same.",
      "example": "Runner moving first to second when the ball enters the adjacent infield: award home.",
      "note": "An adjacent OUTFIELD is different: play continues with interference rules. Wait for a break on the other field to retrieve the ball.",
      "visual": "ball-adjacent-infield",
      "keywords": "another field shot put outfield infield extra bases"
    },
    {
      "id": "tagfair",
      "topic": "Running",
      "title": "When can a runner tag up on a fair fly?",
      "call": "FAIR FLY · FIRST TOUCH",
      "rule": "7.9; 11.2(f), (m)",
      "action": "On a caught fair fly, retouch or remain on the starting base until the first fair-territory touch, then advance at risk. A runner who left after the kick must return to tag up.",
      "example": "Runner holds first. A fair fly is bobbled, then caught: the runner may depart at first fair touch.",
      "note": "Leaving before the kick is a separate out. A missing required tag-up at the end of play is also an out, even without a defensive appeal.",
      "visual": "training-tagfair",
      "keywords": "tag up tagup bobble fair catch runner left early"
    },
    {
      "id": "tagfoul",
      "topic": "Running",
      "title": "When can a runner tag up on a foul fly?",
      "call": "FOUL FLY · COMPLETED CATCH",
      "rule": "7.9; 10.2 footnote 6",
      "action": "Wait on or retouch the starting base until the foul fly is actually caught. Then advance at risk. A caught foul retires the kicker and is live.",
      "example": "A foul fly is bobbled before being caught: do not leave on the bobble; leave when the catch is completed.",
      "note": "This includes caught fouls caused by kicking outside the box or above the knee.",
      "visual": "training-tagfoul",
      "keywords": "tag up tagup foul catch bobble timing"
    },
    {
      "id": "force",
      "topic": "Running",
      "title": "Does another out remove a force?",
      "call": "FORCE REMAINS",
      "rule": "7.7–7.7.2, 7.13",
      "action": "The force begins when the uncaught kick lands fair. First is forced; second/third are forced if all preceding bases were occupied. Boston rules preserve that force after another runner is put out.",
      "example": "Bases loaded: the runner from second is tagged out. The runner from third is still forced home.",
      "note": "A force for the third out cancels all runs on that play. So does retiring the kicker before first.",
      "visual": "force-base-touch",
      "keywords": "force out chain third out run counts bases loaded double play"
    },
    {
      "id": "safety",
      "topic": "Running",
      "title": "Which first base should the runner touch?",
      "call": "RUNNER: SAFETY BASE · FIELDER: FAIR BASE",
      "rule": "7.1–7.3",
      "action": "On a play at first from home, use the safety base unless a listed exception applies. Exceptions include avoiding a fielder in foul territory, advancing toward second, or no fielder on first.",
      "example": "After reaching first safely, start the next play on the fair base. Starting on the safety base is an out.",
      "note": "No sliding into first from home. Overrunning first is allowed; an idle left turn returning directly is not an attempt at second.",
      "visual": null,
      "keywords": "orange safety base first overrun slide left turn"
    },
    {
      "id": "displaced",
      "topic": "Running",
      "title": "The base moved — is the runner safe?",
      "call": "ORIGINAL BASE LOCATION COUNTS",
      "rule": "7.14",
      "action": "A runner touching the original correct location of a displaced base is safe there. Restore the base after the play.",
      "example": "A turf base slides away under a runner; the runner keeps contact with its original spot. Treat that as contact with the base.",
      "note": "",
      "visual": null,
      "keywords": "base moved displaced turf"
    },
    {
      "id": "encroachment",
      "topic": "Fielding",
      "title": "Fielder, pitcher or catcher moves early",
      "call": "FIRST: TEAM WARNING · LATER: FIRST BASE",
      "rule": "5.2.1–5.2.4",
      "action": "Non-catchers stay in fair territory behind the first-to-third diagonal until contact. The pitcher stays fully behind the strip’s front edge. Catcher stays behind/parallel to the kicker when at least one kicker foot is in the box, without restricting the kick.",
      "example": "Pitcher encroaches: warn the team, and redo the play if the defense benefited. The catcher later encroaches: award the kicker first.",
      "note": "Written rule 5.2.4 uses one team-wide warning across ALL types. The training slide’s separate catcher-warning shorthand does not override that rule.",
      "visual": "fielder-crossed-early",
      "keywords": "encroachment catcher pitcher charger early line warning"
    },
    {
      "id": "fairfoul",
      "topic": "Fair & foul",
      "title": "Ball crosses the foul line before a base",
      "call": "UNTOUCHED GROUND BALL · FOUL",
      "rule": "10.2–10.4",
      "action": "An untouched grounded kick that goes foul before first or third is foul. A kick landing fair then going foul beyond first/third is fair. Foul lines are fair territory.",
      "example": "An untouched kick lands fair and rolls foul before first: foul.",
      "note": "Do not decide solely by an airborne ball’s position. A ball landing fair then knocked foul by a fielder stays fair; an airborne ball touched with the player’s feet grounded fair is addressed by 10.3(d).",
      "visual": "fair-foul-location-touch",
      "keywords": "fair foul line ground ball rolls before after first third"
    },
    {
      "id": "box",
      "topic": "Fair & foul",
      "title": "Kicker steps outside the box",
      "call": "FOUL · CAUGHT FOUL IS LIVE",
      "rule": "6.2; 10.2(g), (h), footnote 6",
      "action": "The whole planted foot must be inside the kicking box and no part may cross the front edge of home plate. Outside-box or in-front kicks are foul.",
      "example": "A kick with the planted foot past home plate is caught by a fielder: kicker out, ball live, runners may tag up after the catch.",
      "note": "",
      "visual": null,
      "keywords": "planted foot kicking box home plate catch foul"
    },
    {
      "id": "infieldfly",
      "topic": "Fielding",
      "title": "Is there an infield-fly rule?",
      "call": "NO INFIELD-FLY RULE",
      "rule": "5.3",
      "action": "Fielders may intentionally let a kick drop to attempt a double play. Do not call an automatic infield-fly out.",
      "example": "With runners on first and second, a fielder lets a pop-up land fair and attempts a force at third: play continues.",
      "note": "",
      "visual": null,
      "keywords": "infield fly dropped pop up double play"
    },
    {
      "id": "interference",
      "topic": "Fielding",
      "title": "Fielder blocks a runner or base",
      "call": "HINDERED RUNNER SAFE · CHECK THE PLAY",
      "rule": "7.5; 12.2.1–12.2.1.2",
      "action": "Fielders must avoid the baseline unless actively playing the ball. They may retrieve a kick, hold the ball to tag, or receive a throw at a base without fully blocking access. A fully blocked path to the base makes the runner safe.",
      "example": "A receiver waiting for a teammate’s throw fully blocks the runner’s path to second: runner safe.",
      "note": "Runners must try to avoid a legal active play. If both make good-faith efforts but collide, judge whether the runner would have been safe/out absent the collision.",
      "visual": null,
      "keywords": "obstruction interference collision blocking baseline"
    },
    {
      "id": "head",
      "topic": "Running",
      "title": "Thrown ball hits head or neck",
      "call": "SAFE — EXCEPT THE LISTED EXCEPTIONS",
      "rule": "7.8",
      "action": "For a head/neck hit, award the base the runner was moving toward. The protection has an exception when sliding. Intentionally using the head/neck to block the ball is an out.",
      "example": "An upright runner moving toward second takes a throw to the head without intentionally blocking it: safe at second.",
      "note": "Check for injury and use the league emergency protocol as needed.",
      "visual": null,
      "keywords": "headshot head neck hit throw"
    },
    {
      "id": "fieldkick",
      "topic": "Running",
      "title": "Fielder kicks the ball into a runner",
      "call": "SAFE · AUTOMATIC DEAD BALL",
      "rule": "7.8.1",
      "action": "A ball kicked by a fielder that strikes a runner makes the runner safe and the ball automatically dead. Do not record a tag out from that kick.",
      "example": "A defender kicks the loose ball toward a teammate, but it hits the runner: safe and dead ball.",
      "note": "Different from the kicker’s live kick hitting an off-base runner under 11.2(d). The written rule explicitly adds dead ball to the training slide’s safe shorthand.",
      "visual": null,
      "keywords": "fielder kicked ball runner hit dead"
    },
    {
      "id": "endplay",
      "topic": "Game flow",
      "title": "When does possession end the play?",
      "call": "PITCHER CONTROL NEAR THE STRIP",
      "rule": "12.1; training “End of a Play”",
      "action": "The pitcher must control the ball within 12 feet of the strip center. Give them a chance to continue defense; juggling or further defensive motions are not the end. Once play ends, use runner positions at control.",
      "example": "A runner is moving first to second when control ends the play: award second. A runner between bases but not moving forward returns to the previous base.",
      "note": "",
      "visual": null,
      "keywords": "pitcher mound possession dead end play stop runner"
    },
    {
      "id": "clock",
      "topic": "Game flow",
      "title": "The clock is almost at 40 minutes",
      "call": "START THE NEXT INNING BEFORE THE LIMIT",
      "rule": "4.1–4.1.4; training “Game Flow”",
      "action": "Regular games have a five-inning maximum. Before five innings, if an inning finishes before 40:00, start the next; at 40:00 or later, do not start another. Finish the current inning subject to game-ending exceptions.",
      "example": "Fourth inning ends at 39:59: start the fifth. It ends at 40:00: do not start a fifth.",
      "note": "Only league-directed rain-adjusted turf schedules use the 30-minute limit.",
      "visual": null,
      "keywords": "timer time limit 40 minutes rain 30 inning clock"
    },
    {
      "id": "runcap",
      "topic": "Game flow",
      "title": "Six-run cap and playoffs",
      "call": "REGULAR SEASON CAP · NO PLAYOFF CAP",
      "rule": "4.3.1–4.3.1.1",
      "action": "In regular season, end the half when six runs have scored; additional runs on that same play still count. The cap does not apply in playoffs.",
      "example": "With five runs already scored, a three-run kick scores three: eight runs count for that half.",
      "note": "For a trailing team’s final at-bat down more than six, the exception allows enough runs to tie, not win.",
      "visual": null,
      "keywords": "six 6 run cap mercy playoff maximum"
    },
    {
      "id": "late",
      "topic": "Players & conduct",
      "title": "Late arrival or substitute joins the lineup",
      "call": "LATE TEAM PLAYER GOES BEFORE SUBS",
      "rule": "3.3.1, 3.3.7; Appendix A",
      "action": "Add late team players to the end of the team’s kicking order before substitute players. Subs stay last; at most four and no more than the number of original team players, to fill up to eleven.",
      "example": "Two subs are last in the order. A rostered player arrives: insert that player immediately before the subs.",
      "note": "Subs cannot pitch, catch, or act as a charger. No playoff subs except eligible long-term subs who fully joined the team.",
      "visual": null,
      "keywords": "late arrival lineup kicking order sub substitute players minimum"
    },
    {
      "id": "cards",
      "topic": "Players & conduct",
      "title": "Yellow or red card — what happens next?",
      "call": "YELLOW: REST OF GAME · RED: ALSO NEXT GAME",
      "rule": "15.9.1–15.9.6",
      "action": "In-game yellow removes the player from participation, coaching and official discussions for the rest of that game. Two yellows in a day equal red. Red also excludes the next scheduled game and requires leaving the permitted area.",
      "example": "An ejected baserunner is out and cannot be replaced on base. Skip their lineup spot without another out.",
      "note": "Between-game yellow alone is a warning, counts that day and does not bar the next game. Report cards after the game and send a written account within 48 hours; appoint a temporary captain if needed.",
      "visual": null,
      "keywords": "yellow red card ejection conduct report captain"
    },
    {
      "id": "signals",
      "topic": "Players & conduct",
      "title": "Use a visible signal with your call",
      "call": "SIGNALS ACCOMPANY VERBAL CALLS",
      "rule": "Fall training “Umpire Call Signals”",
      "action": "Use the official call-sign sheet for Ball, Strike, Out, Foul, Fair, Safe, and Dead Ball / Play Ends. The training makes visual signals required.",
      "example": "Give the appropriate visible signal while communicating your call so players can see the decision.",
      "note": "Open the official signal reference below. Whistles are reserved for the league alert system, not umpire calls.",
      "visual": null,
      "keywords": "signal hand gesture whistle deaf call signs"
    }
  ],
  "visuals": {
    "ball-adjacent-infield": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Example: runner leaves first and advances toward second.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                75,
                65
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "fielder",
              "x": 60,
              "y": 58,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 62,
              "y": 56
            }
          ]
        },
        {
          "phase": "play",
          "caption": "At the instant the ball enters the marked area, the runner is moving toward second.",
          "elements": [
            {
              "type": "zone",
              "shape": "rect",
              "x": 84,
              "y": 20,
              "width": 16,
              "height": 28,
              "label": "ADJACENT INFIELD"
            },
            {
              "type": "path",
              "from": [
                62,
                56
              ],
              "to": [
                95,
                32
              ],
              "kind": "throw"
            },
            {
              "type": "ball",
              "x": 95,
              "y": 32
            },
            {
              "type": "runner",
              "x": 63,
              "y": 53,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Adjacent infield: this runner gets second plus two bases, ending at home.",
          "elements": [
            {
              "type": "label",
              "text": "DEAD BALL",
              "x": 50,
              "y": 15
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "path",
              "from": [
                50,
                40
              ],
              "to": [
                25,
                65
              ],
              "kind": "runner"
            },
            {
              "type": "path",
              "from": [
                25,
                65
              ],
              "to": [
                50,
                88
              ],
              "kind": "runner"
            },
            {
              "type": "runner",
              "x": 50,
              "y": 88,
              "label": "R"
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "fair-foul-location-touch": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Example: an untouched kicked ball lands fair before first base.",
          "elements": [
            {
              "type": "ball",
              "x": 60,
              "y": 73
            },
            {
              "type": "label",
              "text": "UNTOUCHED BALL",
              "x": 50,
              "y": 15
            }
          ]
        },
        {
          "phase": "play",
          "caption": "The grounded ball crosses into foul territory on its own before reaching first.",
          "elements": [
            {
              "type": "path",
              "from": [
                60,
                73
              ],
              "to": [
                76,
                81
              ],
              "kind": "ball"
            },
            {
              "type": "ball",
              "x": 76,
              "y": 81
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Foul in this example. Foul lines are fair; fielder-touch cases have separate rules in 10.3.",
          "elements": [
            {
              "type": "label",
              "text": "FOUL",
              "x": 50,
              "y": 15
            },
            {
              "type": "ball",
              "x": 76,
              "y": 81
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "fielder-crossed-early": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Example: a non-catcher fielder stays behind the first-to-third line before contact.",
          "elements": [
            {
              "type": "zone",
              "shape": "line",
              "from": [
                25,
                65
              ],
              "to": [
                75,
                65
              ],
              "label": "1B–3B LINE"
            },
            {
              "type": "fielder",
              "x": 38,
              "y": 54,
              "label": "F"
            },
            {
              "type": "runner",
              "x": 50,
              "y": 88,
              "label": "K"
            },
            {
              "type": "ball",
              "x": 50,
              "y": 75
            }
          ]
        },
        {
          "phase": "play",
          "caption": "Fielder crosses the line while the pitch is still approaching the kicker.",
          "elements": [
            {
              "type": "zone",
              "shape": "line",
              "from": [
                25,
                65
              ],
              "to": [
                75,
                65
              ],
              "label": "1B–3B LINE"
            },
            {
              "type": "path",
              "from": [
                38,
                54
              ],
              "to": [
                38,
                73
              ],
              "kind": "fielder"
            },
            {
              "type": "fielder",
              "x": 38,
              "y": 73,
              "label": "F"
            },
            {
              "type": "runner",
              "x": 50,
              "y": 88,
              "label": "K"
            },
            {
              "type": "ball",
              "x": 50,
              "y": 80
            }
          ]
        },
        {
          "phase": "call",
          "caption": "First team infraction: warning, with a do-over if defense benefited. Later infractions: award first.",
          "elements": [
            {
              "type": "label",
              "text": "ENCROACHMENT",
              "x": 50,
              "y": 15
            },
            {
              "type": "zone",
              "shape": "line",
              "from": [
                25,
                65
              ],
              "to": [
                75,
                65
              ],
              "label": "1B–3B LINE"
            },
            {
              "type": "fielder",
              "x": 38,
              "y": 73,
              "label": "F"
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "force-base-touch": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "A kicked ball lands fair without being caught. Runner on first is forced toward second.",
          "elements": [
            {
              "type": "ball",
              "x": 42,
              "y": 55
            },
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "runner",
              "x": 58,
              "y": 81,
              "label": "K"
            },
            {
              "type": "fielder",
              "x": 50,
              "y": 40,
              "label": "F"
            }
          ]
        },
        {
          "phase": "play",
          "caption": "Defender touches second with possession before the forced runner reaches it.",
          "elements": [
            {
              "type": "path",
              "from": [
                75,
                65
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "runner",
              "x": 60,
              "y": 50,
              "label": "R"
            },
            {
              "type": "fielder",
              "x": 50,
              "y": 40,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 52,
              "y": 38
            }
          ]
        },
        {
          "phase": "call",
          "caption": "The forced runner is out; no body tag is needed.",
          "elements": [
            {
              "type": "label",
              "text": "FORCE OUT",
              "x": 50,
              "y": 15
            },
            {
              "type": "fielder",
              "x": 50,
              "y": 40,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 52,
              "y": 38
            },
            {
              "type": "runner",
              "x": 60,
              "y": 50,
              "label": "R"
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "overthrow-left-game-area": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Example: runner leaves first and advances toward second.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                75,
                65
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "fielder",
              "x": 60,
              "y": 58,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 62,
              "y": 56
            }
          ]
        },
        {
          "phase": "play",
          "caption": "At the instant the ball enters the marked area, the runner is moving toward second.",
          "elements": [
            {
              "type": "zone",
              "shape": "edge",
              "side": "right",
              "label": "GAME BOUNDARY"
            },
            {
              "type": "path",
              "from": [
                62,
                56
              ],
              "to": [
                98,
                42
              ],
              "kind": "throw"
            },
            {
              "type": "ball",
              "x": 98,
              "y": 42
            },
            {
              "type": "runner",
              "x": 63,
              "y": 53,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Out-of-bounds overthrow: this runner gets second plus one base, ending at third.",
          "elements": [
            {
              "type": "label",
              "text": "DEAD BALL",
              "x": 50,
              "y": 15
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "path",
              "from": [
                50,
                40
              ],
              "to": [
                25,
                65
              ],
              "kind": "runner"
            },
            {
              "type": "runner",
              "x": 25,
              "y": 65,
              "label": "R"
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "overthrow-past-first": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Fields 5/6 example: defense throws toward first after the kick.",
          "elements": [
            {
              "type": "runner",
              "x": 65,
              "y": 74,
              "label": "K"
            },
            {
              "type": "fielder",
              "x": 75,
              "y": 65,
              "label": "1B"
            },
            {
              "type": "ball",
              "x": 60,
              "y": 55
            }
          ]
        },
        {
          "phase": "play",
          "caption": "Ball remains playable, more than 15 feet beyond the foul line. Distance is schematic.",
          "elements": [
            {
              "type": "path",
              "from": [
                60,
                55
              ],
              "to": [
                90,
                78
              ],
              "kind": "throw"
            },
            {
              "type": "ball",
              "x": 90,
              "y": 78
            },
            {
              "type": "runner",
              "x": 64,
              "y": 54,
              "label": "K"
            },
            {
              "type": "path",
              "from": [
                75,
                65
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Kicker may reach second at risk. Beyond second requires defense to bring the ball back and continue play.",
          "elements": [
            {
              "type": "label",
              "text": "LIVE • AT RISK",
              "x": 50,
              "y": 15
            },
            {
              "type": "runner",
              "x": 50,
              "y": 40,
              "label": "K"
            },
            {
              "type": "ball",
              "x": 90,
              "y": 78
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "overthrow-unsafe-area": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Example: runner leaves first and advances toward second.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                75,
                65
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "fielder",
              "x": 60,
              "y": 58,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 62,
              "y": 56
            }
          ]
        },
        {
          "phase": "play",
          "caption": "At the instant the ball enters the marked area, the runner is moving toward second.",
          "elements": [
            {
              "type": "zone",
              "shape": "circle",
              "x": 88,
              "y": 58,
              "radius": 8,
              "label": "UNSAFE AREA"
            },
            {
              "type": "path",
              "from": [
                62,
                56
              ],
              "to": [
                88,
                58
              ],
              "kind": "throw"
            },
            {
              "type": "ball",
              "x": 88,
              "y": 58
            },
            {
              "type": "runner",
              "x": 63,
              "y": 53,
              "label": "R"
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Dead ball inside unsafe area: this runner goes to second, with no extra base.",
          "elements": [
            {
              "type": "label",
              "text": "DEAD BALL",
              "x": 50,
              "y": 15
            },
            {
              "type": "path",
              "from": [
                63,
                53
              ],
              "to": [
                50,
                40
              ],
              "kind": "runner"
            },
            {
              "type": "runner",
              "x": 50,
              "y": 40,
              "label": "R"
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "pitch-enters-strike-zone": {
      "field": "strike_zone_front",
      "orientation": "home-at-bottom",
      "steps": [
        {
          "phase": "before",
          "caption": "Front elevation: one-foot-high zone, with one foot added on each side of the plate. Depth follows the plate.",
          "elements": [
            {
              "type": "label",
              "text": "FRONT VIEW",
              "x": 50,
              "y": 15
            },
            {
              "type": "ball",
              "x": 80,
              "y": 50
            }
          ]
        },
        {
          "phase": "play",
          "caption": "Example assumes a legal rolling/two-bounce pitch and no excessive height in the kicking box.",
          "elements": [
            {
              "type": "label",
              "text": "LEGAL PITCH",
              "x": 50,
              "y": 15
            },
            {
              "type": "ball",
              "x": 69,
              "y": 56
            }
          ]
        },
        {
          "phase": "call",
          "caption": "An un-kicked legal pitch overlapping the zone is a strike. Check Rule 9.2 before calling it.",
          "elements": [
            {
              "type": "label",
              "text": "STRIKE",
              "x": 50,
              "y": 15
            },
            {
              "type": "ball",
              "x": 69,
              "y": 56
            }
          ]
        }
      ],
      "not_to_scale": true
    },
    "training-tagfair": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "not_to_scale": true,
      "steps": [
        {
          "phase": "before",
          "caption": "Runner holds first while the kicked fly approaches the fielder in fair territory.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "fielder",
              "x": 68,
              "y": 45,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 63,
              "y": 39
            }
          ]
        },
        {
          "phase": "play",
          "caption": "First fair-territory touch: runner may leave from first now, even if the catch is completed after a bobble.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "fielder",
              "x": 68,
              "y": 45,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 68,
              "y": 45
            },
            {
              "type": "label",
              "text": "FIRST TOUCH",
              "x": 50,
              "y": 15
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Fair catch completed: kicker out. Runner who left at first fair touch may continue at risk.",
          "elements": [
            {
              "type": "fielder",
              "x": 68,
              "y": 45,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 68,
              "y": 45
            },
            {
              "type": "path",
              "kind": "runner",
              "from": [
                75,
                65
              ],
              "to": [
                60,
                50
              ]
            },
            {
              "type": "runner",
              "x": 60,
              "y": 50,
              "label": "R"
            },
            {
              "type": "label",
              "text": "ADVANCE AT RISK",
              "x": 50,
              "y": 15
            }
          ]
        }
      ]
    },
    "training-tagfoul": {
      "field": "kickball_standard",
      "orientation": "home-at-bottom",
      "not_to_scale": true,
      "steps": [
        {
          "phase": "before",
          "caption": "Runner holds first while the kicked fly approaches the fielder in foul territory.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "fielder",
              "x": 88,
              "y": 60,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 83,
              "y": 54
            }
          ]
        },
        {
          "phase": "play",
          "caption": "First foul-territory touch is a bobble. Runner must still hold or retouch first until the catch is completed.",
          "elements": [
            {
              "type": "runner",
              "x": 75,
              "y": 65,
              "label": "R"
            },
            {
              "type": "fielder",
              "x": 88,
              "y": 60,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 88,
              "y": 60
            },
            {
              "type": "label",
              "text": "FIRST TOUCH",
              "x": 50,
              "y": 15
            }
          ]
        },
        {
          "phase": "call",
          "caption": "Foul catch completed: kicker out. Runner may now leave from first and advance at risk.",
          "elements": [
            {
              "type": "fielder",
              "x": 88,
              "y": 60,
              "label": "F"
            },
            {
              "type": "ball",
              "x": 88,
              "y": 60
            },
            {
              "type": "path",
              "kind": "runner",
              "from": [
                75,
                65
              ],
              "to": [
                60,
                50
              ]
            },
            {
              "type": "runner",
              "x": 60,
              "y": 50,
              "label": "R"
            },
            {
              "type": "label",
              "text": "ADVANCE AT RISK",
              "x": 50,
              "y": 15
            }
          ]
        }
      ]
    }
  }
};
