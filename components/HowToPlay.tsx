'use client'

export default function HowToPlay() {
  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>HOW TO PLAY</h2>
        <p style={{ color: '#888', fontSize: '14px', fontWeight: 500 }}>
          Master the game • Dominate the leaderboards
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        {/* Daily Tasks */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #00d4ff',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(0, 212, 255, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#00d4ff',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>📋</span> DAILY TASKS
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Add up to 10 tasks per day</strong> - Set your goals and track your progress
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Complete tasks</strong> - Check them off as you finish them
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Daily reset at 5pm EST</strong> - All tasks reset automatically, so stay consistent!
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Each completed task</strong> gives you +1 lifetime EXP and increases your daily level
            </p>
          </div>
        </div>

        {/* Level & Avatar System */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #ff6b35',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(255, 107, 53, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ff6b35',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⭐</span> LEVEL & AVATAR SYSTEM
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Daily Level (0-10)</strong> - Based on how many tasks you complete today. Your avatar changes appearance with each level!
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Lifetime EXP</strong> - Permanent experience points that accumulate over time. Never resets!
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Gold</strong> - Earn 10 gold per completed task. Use it to buy items in the shop!
            </p>
          </div>
        </div>

        {/* Shop & Items */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #9b59b6',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(155, 89, 182, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#9b59b6',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>🛒</span> SHOP & ITEMS
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>⚔️ WEAPONS</strong> - Attack other players to reduce their lifetime EXP. Damage: Wooden Sword (10), Iron Sword (25), Diamond Sword (50)
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>🛡️ ARMOUR</strong> - Protects you from attacks. Protection: Leather (5 PROT.), Iron (15 PROT.), Diamond (30 PROT.). Armour stacks!
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>🧪 POTIONS</strong> - Give you temporary immunity from attacks (24h or 48h)
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>📜 NAME CHANGE SCROLL</strong> - Change someone else's displayed username (ELITE ONLY)
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#ff4444', fontWeight: 700 }}>⚠️ ELITE ITEMS:</strong> Only the first 3 players who complete all 10 tasks can buy weapons and name change scrolls!
            </p>
          </div>
        </div>

        {/* Leaderboards */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #ffd700',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(255, 215, 0, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ffd700',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>🏆</span> LEADERBOARDS
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Daily Leaderboard</strong> - Shows all players ranked by their daily level (0-10). Click on a player to see their tasks!
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Lifetime Leaderboard</strong> - Shows all players ranked by their lifetime EXP. The ultimate measure of dedication!
            </p>
          </div>
        </div>

        {/* Friends */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #4caf50',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(76, 175, 80, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#4caf50',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>👥</span> FRIENDS SYSTEM
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Send friend requests</strong> - Connect with other players
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Accept or reject</strong> - Manage your friend list
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• View friends' progress</strong> - See how your friends are doing on the leaderboards
            </p>
          </div>
        </div>

        {/* Combat System */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          border: '2px solid #ff4444',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(255, 68, 68, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ff4444',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚔️</span> COMBAT SYSTEM
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Attack Formula:</strong> Weapon Damage - Target's Total Armour Protection = Actual Damage
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Example:</strong> Diamond Sword (50 damage) vs Leather Armour (5 PROT.) = 45 EXP lost
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Armour stacks!</strong> If you have multiple armour pieces, their protection values add up
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>• Minimum damage:</strong> Even with strong armour, you'll always take at least 0 damage (can't go negative)
            </p>
          </div>
        </div>

        {/* Pro Tips */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0a2a 0%, #2a1a3a 100%)',
          border: '2px solid #ff6b9d',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 8px 30px rgba(255, 107, 157, 0.2)'
        }}>
          <h3 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ff6b9d',
            margin: '0 0 15px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>💡</span> PRO TIPS
          </h3>
          <div style={{ color: '#ccc', fontSize: '15px', lineHeight: '1.8', fontWeight: 500 }}>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>1. Complete all 10 tasks</strong> - Be one of the first 3 to unlock elite status and buy exclusive items!
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>2. Stack armour</strong> - Multiple armour pieces provide better protection
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>3. Use potions strategically</strong> - Activate immunity before big battles
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>4. Check leaderboards daily</strong> - See who's climbing the ranks
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: '#fff', fontWeight: 700 }}>5. Consistency is key</strong> - Complete tasks every day to build your lifetime EXP
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

