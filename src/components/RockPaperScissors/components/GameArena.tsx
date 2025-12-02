'use client';

import React from 'react';
import { Choice } from '../types';
import ChoiceIcon from './ChoiceIcon';

interface GameArenaProps {
  playerChoice: Choice | null;
  computerChoice: Choice | null;
  loadingResult: boolean;
}

const GameArena: React.FC<GameArenaProps> = ({ playerChoice, computerChoice, loadingResult }) => {
  return (
    <div className="space-y-1">
      {/* Game display area with center-aligned wrapper */}
      <div style={{
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '1rem',
        padding: '1.25rem',
        minHeight: '130px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Centered player choices wrapper */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto'
        }}>
          {/* Player choice */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '80px'
          }}>
            <div style={{
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {playerChoice && !loadingResult ? (
                <div className="animate-[appear_0.4s_ease-out_forwards] scale-110">
                  <ChoiceIcon choice={playerChoice} size="lg" />
                </div>
              ) : loadingResult ? (
                <div className="animate-pulse">
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#F5F3FF',
                    borderColor: '#DDD6FE',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}>
                    <span className="text-lg">👤</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                  backgroundColor: '#F5F3FF',
                  borderColor: '#DDD6FE',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}>
                  <span className="text-lg">👤</span>
                </div>
              )}
            </div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              marginTop: '0.5rem',
              backgroundColor: '#F5F3FF',
              borderColor: '#DDD6FE',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              width: '3.5rem',
              textAlign: 'center',
              color: '#7C3AED'
            }}>
              You
            </div>
          </div>

          {/* VS divider */}
          <div style={{
            width: '80px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div
              className={loadingResult ? "animate-pulse" : ""}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 0.75rem',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <span style={{
                fontSize: '1.15rem',
                fontWeight: '700',
                color: '#8B5CF6',
                letterSpacing: '0.05em'
              }}>
                {loadingResult ? "..." : "VS"}
              </span>
            </div>
          </div>

          {/* Computer choice */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '80px'
          }}>
            <div style={{
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {computerChoice && !loadingResult ? (
                <div className="animate-[appear_0.4s_ease-out_forwards] scale-110">
                  <ChoiceIcon choice={computerChoice} size="lg" />
                </div>
              ) : loadingResult ? (
                <div className="animate-pulse">
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#F5F3FF',
                    borderColor: '#DDD6FE',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}>
                    <span className="text-lg">🤖</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                  backgroundColor: '#F5F3FF',
                  borderColor: '#DDD6FE',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}>
                  <span className="text-lg">🤖</span>
                </div>
              )}
            </div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '500',
              marginTop: '0.5rem',
              backgroundColor: '#F5F3FF',
              borderColor: '#DDD6FE',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              width: '3.5rem',
              textAlign: 'center',
              color: '#7C3AED'
            }}>
              CPU
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameArena;