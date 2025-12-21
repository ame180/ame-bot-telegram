<?php

$rules = [
	'@Symfony' => true,
	'concat_space' => [
		'spacing' => 'one'
	],
];
$finder = PhpCsFixer\Finder::create()
	->in(['src'])
	->append(['run.php']);

return (new PhpCsFixer\Config())
	->setRules($rules)
	->setFinder($finder);