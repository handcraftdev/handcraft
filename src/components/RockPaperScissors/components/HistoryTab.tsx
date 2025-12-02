'use client';

import React, { useState } from 'react';

interface HistoryTabProps {
  recentGames?: Array<{
    id: string;
    date: string;
    playerChoice: string;
    computerChoice: string;
    result: string;
    difficulty?: string; // Optional for backward compatibility
  }>;
  onClear?: () => void; // Optional callback to clear history
}

const HistoryTab: React.FC<HistoryTabProps> = ({ 
  recentGames = [],
  onClear
}) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  const totalPages = Math.ceil(recentGames.length / recordsPerPage);
  
  // Calculate visible records for the current page
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = recentGames.slice(indexOfFirstRecord, indexOfLastRecord);
  
  // Get emoji for choice
  const getChoiceEmoji = (choice: string) => {
    return choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️';
  };
  
  // Format date to be more compact
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();
      
      return {
        display: isToday 
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fullDate: date.toLocaleString()
      };
    } catch {
      return { display: dateString, fullDate: dateString };
    }
  };
  
  // Get text color for result
  const getResultColor = (result: string) => {
    return result === 'win' 
      ? 'text-green-600'
      : result === 'lose'
        ? 'text-red-600'
        : 'text-gray-600';
  };
  
  // If no games yet, show placeholder
  if (recentGames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center" style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div className="text-4xl mb-4">📜</div>
        <h3 className="text-lg font-semibold mb-2 text-gray-700">No Game History Yet</h3>
        <p className="text-sm text-gray-500">
          Play a few games and your history will appear here.
        </p>
      </div>
    );
  }

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="p-2 text-center" style={{ maxWidth: '400px', margin: '0 auto' }}>
      {/* Clear button removed from here, moved to bottom */}
      
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-center">
          <thead>
            <tr style={{ backgroundColor: '#3b7dd8', color: 'white' }}>
              <th className="px-1 py-1 text-xs font-medium">Time</th>
              <th className="px-1 py-1 text-xs font-medium">You</th>
              <th className="px-1 py-1 text-xs font-medium"></th>
              <th className="px-1 py-1 text-xs font-medium">CPU</th>
              <th className="px-1 py-1 text-xs font-medium">Result</th>
              <th className="px-1 py-1 text-xs font-medium">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentRecords.map((game, index) => (
              <tr
                key={game.id}
                style={{
                  backgroundColor: index % 2 === 0 ? 'white' : 'rgba(246, 240, 255, 0.5)',
                  transition: 'background-color 0.15s ease-in-out'
                }}
                className="hover:bg-gray-50"
              >
                <td className="px-1 py-1.5 text-xs text-gray-500 whitespace-nowrap">
                  <span title={formatDate(game.date).fullDate}>
                    {formatDate(game.date).display}
                  </span>
                </td>
                <td className="px-1 py-1.5">
                  <span className="text-base" title={game.playerChoice}>
                    {getChoiceEmoji(game.playerChoice)}
                  </span>
                </td>
                <td className="px-1 py-1.5 text-gray-400 text-xs">vs</td>
                <td className="px-1 py-1.5">
                  <span className="text-base" title={game.computerChoice}>
                    {getChoiceEmoji(game.computerChoice)}
                  </span>
                </td>
                <td className={`px-1 py-1.5 text-xs font-medium whitespace-nowrap ${getResultColor(game.result)}`}>
                  {game.result.toUpperCase()}
                </td>
                <td className="px-1 py-1.5 text-xs text-gray-500 capitalize whitespace-nowrap">
                  {game.difficulty || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-2">
          <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => paginate(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-1 text-xs font-medium rounded-l-md border border-gray-300"
              style={{
                backgroundColor: currentPage === 1 ? '#f5f5f5' : 'white',
                color: currentPage === 1 ? '#aaa' : '#555',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              &laquo;
            </button>
            
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
              // Calculate page number intelligently when there are many pages
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = index + 1;
              } else if (currentPage <= 3) {
                pageNumber = index + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + index;
              } else {
                pageNumber = currentPage - 2 + index;
              }
              
              return (
                <button
                  key={pageNumber}
                  onClick={() => paginate(pageNumber)}
                  className="relative inline-flex items-center px-2 py-1 text-xs font-medium border border-gray-300"
                  style={{
                    backgroundColor: currentPage === pageNumber ? 'rgba(110, 54, 181, 0.1)' : 'white',
                    color: currentPage === pageNumber ? '#6e36b5' : '#555',
                    zIndex: currentPage === pageNumber ? 10 : 'auto'
                  }}
                >
                  {pageNumber}
                </button>
              );
            })}
            
            <button
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-1 text-xs font-medium rounded-r-md border border-gray-300"
              style={{
                backgroundColor: currentPage === totalPages ? '#f5f5f5' : 'white',
                color: currentPage === totalPages ? '#aaa' : '#555',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              &raquo;
            </button>
          </nav>
        </div>
      )}

      {/* Clear button at bottom center */}
      {onClear && recentGames.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button
            onClick={onClear}
            style={{
              padding: '0.5rem 1rem',
              color: '#dc2626',
              fontSize: '0.75rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(254, 226, 226, 0.3)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#b91c1c';
              e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.3)';
            }}
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;