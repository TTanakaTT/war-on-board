import { GameService } from '$lib/domain/services/GameService';

const TURN_TIME_LIMIT = 10;

let _timeRemaining = $state<number>(TURN_TIME_LIMIT);
let _timerId = $state<number | null>(null);
let _isActive = $state<boolean>(false);

function startTimer(): void {
	if (_timerId !== null) {
		clearInterval(_timerId);
	}
	_timeRemaining = TURN_TIME_LIMIT;
	_isActive = true;

	_timerId = setInterval(() => {
		_timeRemaining--;
		if (_timeRemaining <= 0) {
			stopTimer();
			GameService.nextTurn();
		}
	}, 1000) as unknown as number;
}

function stopTimer(): void {
	if (_timerId !== null) {
		clearInterval(_timerId);
		_timerId = null;
	}
	_isActive = false;
}

function getTimeRemaining(): number {
	return _timeRemaining;
}

function isActive(): boolean {
	return _isActive;
}

function resetTimer(): void {
	_timeRemaining = TURN_TIME_LIMIT;
}

export const timerState = {
	startTimer,
	stopTimer,
	getTimeRemaining,
	isActive,
	resetTimer
};
